import { BadRequestError } from "./errors";

export async function parseRouteParams<
    T extends Record<string, string>,
>(
    params: Promise<T>,
): Promise<T> {
    const resolved = await params;

    for (const [key, value] of Object.entries(resolved)) {
        if (!value) {
            throw new BadRequestError(
                `Missing route parameter: ${key}.`,
            );
        }
    }

    return resolved;
}