import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ComponentCatalog } from "./component-catalog";

export const metadata: Metadata = { title: "Katalog komponen", robots: { index: false, follow: false } };

/** Development-only reference of the shared form components (TB-015). Returns 404 in production. */
export default function ComponentCatalogPage() {
    if (process.env.NODE_ENV === "production") notFound();
    return <ComponentCatalog />;
}
