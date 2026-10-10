const tlsConnectionStringParameters = new Set([
    "sslmode",
    "sslcert",
    "sslkey",
    "sslrootcert",
]);

/** These parameters can replace node-postgres' explicit TLS object during URL parsing. */
export function getPostgresTlsQueryParameters(connectionString: string) {
    try {
        const url = new URL(connectionString);
        if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") return [];

        return [...new Set(
            [...url.searchParams.keys()]
                .map((key) => key.toLowerCase())
                .filter((key) => tlsConnectionStringParameters.has(key)),
        )];
    } catch {
        return [];
    }
}
