import { toast } from "sonner";

/** One place for toast wording and options, so every confirmation looks the same. */
export const notify = {
    success(message: string) {
        toast.success(message);
    },
    error(message: string) {
        toast.error(message);
    },
};
