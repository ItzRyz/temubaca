import "server-only";

import {
    applyRetention,
    listAuthDeletionsToRetry,
    listDueDeletions,
    markAuthDeleted,
    purgeAccount,
    saveRetentionRun,
    type RetentionSummary,
} from "@/lib/db/queries/account-deletion";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { removeEvidenceFile } from "@/lib/supabase/storage";

async function deleteAuthUser(userId: string) {
    const admin = getSupabaseAdmin();
    if (!admin) return false;
    const { error } = await admin.auth.admin.deleteUser(userId);
    // An already-missing auth user counts as removed.
    if (error && !/not.?found/i.test(error.message)) return false;
    await markAuthDeleted(userId);
    return true;
}

/**
 * One DEC-11 retention pass: anonymise accounts past their 14-day grace period, retry auth
 * removals that failed before, then apply the time-based limits. Safe to run repeatedly.
 */
export async function runRetention(actorId: string | null, now = new Date()): Promise<RetentionSummary> {
    let accountsDeleted = 0;
    let accountsBlocked = 0;
    const files: string[] = [];

    for (const { id } of await listDueDeletions(now)) {
        const result = await purgeAccount(id, now);
        if (result.status === "purged") {
            accountsDeleted += 1;
            files.push(...result.filePaths);
            await deleteAuthUser(id);
        } else if (result.status === "blocked") {
            accountsBlocked += 1;
        }
    }
    for (const { id } of await listAuthDeletionsToRetry()) await deleteAuthUser(id);

    const retention = await applyRetention(now);
    files.push(...retention.filePaths);
    await Promise.all(files.map((path) => removeEvidenceFile(path).catch(() => undefined)));

    const summary: RetentionSummary = {
        ranAt: now.toISOString(),
        accountsDeleted,
        accountsBlocked,
        reportDetails: retention.reportDetails,
        auditEntries: retention.auditEntries,
        loans: retention.loans,
        evidence: retention.evidence,
    };
    await saveRetentionRun(summary, actorId);
    return summary;
}
