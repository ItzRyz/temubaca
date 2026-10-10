import { apiSuccess, requireApiRateLimit, requireApiUser, withApiHandler } from "@/lib/api";
import { getBookRecommendations } from "@/features/recommendations/queries";
import { createUserRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";

export const GET = withApiHandler(async () => {
    const user = await requireApiUser();
    await requireApiRateLimit({
        key: createUserRateLimitKey("recommendations-read", user.id),
        ...RATE_LIMITS.READ,
    });

    const result = await getBookRecommendations(user.id);
    const items = result.items.map(({ id, title, authors, categories, coverUrl, reason }) => ({
        id,
        title,
        authors,
        categories,
        coverUrl,
        reason,
    }));

    return apiSuccess({ items, fallback: result.fallback });
});
