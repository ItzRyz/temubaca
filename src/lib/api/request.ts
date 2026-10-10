import {
    ApiError,
    BadRequestError,
    PayloadTooLargeError,
} from "./errors";

export const MAX_JSON_BODY_BYTES = 1_048_576;

async function readBodyWithLimit(
    stream: ReadableStream<Uint8Array>,
): Promise<Uint8Array> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    try {
        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            totalBytes += value.byteLength;

            if (totalBytes > MAX_JSON_BODY_BYTES) {
                await reader.cancel();
                throw new PayloadTooLargeError();
            }

            chunks.push(value);
        }
    } finally {
        reader.releaseLock();
    }

    const body = new Uint8Array(totalBytes);
    let offset = 0;

    for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.byteLength;
    }

    return body;
}

export async function parseJsonBody<T = unknown>(
    request: Request,
): Promise<T> {
    const contentType = request.headers.get("content-type");
    const mediaType = contentType
        ?.split(";", 1)[0]
        ?.trim()
        .toLowerCase();

    if (mediaType !== "application/json") {
        throw new BadRequestError(
            "Request body must use application/json.",
        );
    }

    const contentLength = request.headers.get("content-length");

    if (contentLength !== null) {
        const declaredBytes = Number(contentLength);

        if (!Number.isSafeInteger(declaredBytes) || declaredBytes < 0) {
            throw new BadRequestError("Invalid Content-Length header.");
        }

        if (declaredBytes > MAX_JSON_BODY_BYTES) {
            throw new PayloadTooLargeError();
        }
    }

    try {
        if (!request.body) {
            throw new BadRequestError("Invalid JSON request body.");
        }

        const body = await readBodyWithLimit(request.body);
        const text = new TextDecoder("utf-8", { fatal: true }).decode(body);

        return JSON.parse(text) as T;
    } catch (error: unknown) {
        if (error instanceof ApiError) {
            throw error;
        }

        throw new BadRequestError(
            "Invalid JSON request body.",
        );
    }
}

export function getSearchParams(request: Request) {
    return new URL(request.url).searchParams;
}

export function getSearchParam(
    request: Request,
    name: string,
) {
    return getSearchParams(request).get(name);
}

export function getRequiredSearchParam(
    request: Request,
    name: string,
) {
    const value = getSearchParam(request, name);

    if (!value) {
        throw new BadRequestError(
            `Missing query parameter: ${name}.`,
        );
    }

    return value;
}
