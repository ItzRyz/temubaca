import type { Metadata } from "next";

import { privateMetadata } from "@/config/site";

/** Sign-in, sign-up and recovery pages: no value in search results. */
export const metadata: Metadata = privateMetadata;

export default function AuthLayout({ children }: LayoutProps<"/">) {
    return children;
}
