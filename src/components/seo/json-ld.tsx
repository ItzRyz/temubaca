/** JSON for a `<script type="application/ld+json">`: `<` is escaped so text can never close the script. */
export function jsonLdText(data: object) {
    return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** Structured data for search engines (schema.org), rendered on the server (SEO, 29 Okt 2026). */
export function JsonLd({ data }: { data: object }) {
    return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(data) }} />;
}
