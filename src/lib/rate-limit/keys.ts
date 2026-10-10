export function createUserRateLimitKey(
    operation: string,
    userId: string,
) {
    return `user:${userId}:${operation}`;
}

export function createIpRateLimitKey(
    operation: string,
    clientIp: string,
) {
    return `ip:${clientIp}:${operation}`;
}

export function createAnonymousRateLimitKey(
    operation: string,
    anonymousId: string,
) {
    return `anonymous:${anonymousId}:${operation}`;
}
