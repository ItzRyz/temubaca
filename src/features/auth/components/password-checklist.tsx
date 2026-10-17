import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { newPasswordRules } from "@/lib/validation/schemas/auth.schema";

type ChecklistItem = { label: string; met: boolean };

/** Live password requirements (Figma: Atur Ulang 58:22974). */
export function PasswordChecklist({ password, extra = [], id }: {
    password: string;
    extra?: ChecklistItem[];
    id?: string;
}) {
    const items: ChecklistItem[] = [
        ...newPasswordRules.map((rule) => ({ label: rule.label, met: rule.test(password) })),
        ...extra,
    ];

    return (
        <ul id={id} aria-label="Syarat kata sandi" className="flex list-none flex-col gap-1 p-0 text-xs leading-[18px]">
            {items.map((item) => (
                <li key={item.label} className={cn("flex items-center gap-2", item.met ? "text-primary" : "text-muted-foreground")}>
                    {item.met
                        ? <Check aria-hidden="true" className="size-3" />
                        : <span aria-hidden="true" className="mx-[3px] size-1.5 rounded-full bg-current opacity-60" />}
                    {item.label}
                    <span className="sr-only">{item.met ? "(terpenuhi)" : "(belum terpenuhi)"}</span>
                </li>
            ))}
        </ul>
    );
}
