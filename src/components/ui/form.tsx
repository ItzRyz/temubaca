"use client";

import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { useId, type ComponentProps, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Shared form primitives (TB-015). Every control is 44px tall (touch target), uses the same focus
 * ring, and gets its hint/error wired through `aria-describedby` so screen readers read them.
 */

export const controlClass =
    "w-full min-w-0 rounded-lg border border-input bg-card px-3.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/25";

export type ControlProps = { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean };

export function describedBy(id: string, hint?: ReactNode, error?: string | null) {
    return [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
}

/** Label + control + hint + error. `children` receives the props to spread on the control. */
export function Field({ label, hint, error, required, id: idProp, className, labelClassName, children }: {
    label: ReactNode;
    hint?: ReactNode;
    error?: string | null;
    required?: boolean;
    id?: string;
    className?: string;
    labelClassName?: string;
    children: (control: ControlProps) => ReactNode;
}) {
    const generated = useId();
    const id = idProp ?? generated;
    return (
        <div className={cn("flex flex-col gap-1.5", className)}>
            <label htmlFor={id} className={cn("text-sm font-medium text-foreground", labelClassName)}>
                {label}
                {required && <span aria-hidden="true" className="text-destructive"> *</span>}
            </label>
            {children({ id, "aria-describedby": describedBy(id, hint, error), "aria-invalid": error ? true : undefined })}
            {hint && <p id={`${id}-hint`} className="text-xs leading-5 text-muted-foreground">{hint}</p>}
            <FieldError id={`${id}-error`} message={error} />
        </div>
    );
}

export function FieldError({ id, message, className }: { id: string; message?: string | null; className?: string }) {
    if (!message) return null;
    return <p id={id} role="alert" className={cn("text-[13px] leading-5 text-destructive", className)}>{message}</p>;
}

export function TextInput({ className, ...props }: ComponentProps<"input">) {
    return <input className={cn(controlClass, "h-11", className)} {...props} />;
}

export function TextArea({ className, rows = 3, ...props }: ComponentProps<"textarea">) {
    return <textarea rows={rows} className={cn(controlClass, "min-h-[88px] py-2.5 leading-6", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
    return <select className={cn(controlClass, "h-11 pr-8", className)} {...props} />;
}

/** On/off control with `role="switch"`; label it with `aria-labelledby` or `aria-label`. */
export function Switch({ checked, onCheckedChange, className, ...props }: Omit<ComponentProps<"button">, "onChange" | "role"> & {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onCheckedChange(!checked)}
            className={cn(
                "relative h-6 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60",
                checked ? "bg-primary" : "bg-[#d9ddd8]",
                className,
            )}
            {...props}
        >
            <span aria-hidden="true" className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left]", checked ? "left-[26px]" : "left-0.5")} />
        </button>
    );
}

const alertTone = {
    error: { className: "bg-destructive/10 text-destructive", icon: AlertCircle, role: "alert" as const },
    success: { className: "bg-[#e7efe8] text-primary", icon: CheckCircle2, role: "status" as const },
    info: { className: "bg-[#f1f0ea] text-muted-foreground", icon: Info, role: "status" as const },
};

/** Form-level message: errors are announced immediately, success/info politely. */
export function FormAlert({ tone = "error", children, className, id }: { tone?: keyof typeof alertTone; children?: ReactNode; className?: string; id?: string }) {
    if (!children) return null;
    const { className: toneClass, icon: Icon, role } = alertTone[tone];
    return (
        <p id={id} role={role} className={cn("flex gap-2 rounded-lg px-3 py-2 text-sm leading-6", toneClass, className)}>
            <Icon aria-hidden="true" className="mt-1 size-4 shrink-0" />
            <span>{children}</span>
        </p>
    );
}

/**
 * A radio or checkbox with its label as one 40px+ tap target; the focus ring wraps the whole row.
 * Pass the input props (`type`, `name`, `value`, …) and the visible label as children.
 */
export function ChoiceOption({ children, className, ...input }: Omit<ComponentProps<"input">, "children"> & { children: ReactNode }) {
    return (
        <label className={cn(
            "flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
            className,
        )}>
            <input className="size-4 shrink-0 accent-primary focus-visible:outline-none" {...input} />
            {children}
        </label>
    );
}
