import { rootCertificates } from "node:tls";

/** Keep TLS verification on; an optional PEM CA augments Node's default trust store. */
export function getDatabaseTlsConfig(
    nodeEnv: "development" | "test" | "production",
    customCa?: string,
) {
    if (nodeEnv !== "production") return undefined;

    return {
        rejectUnauthorized: true as const,
        ...(customCa ? { ca: [...rootCertificates, customCa] } : {}),
    };
}
