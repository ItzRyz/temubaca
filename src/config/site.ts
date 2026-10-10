import type { Metadata } from "next";

import { appConfig } from "@/config/app";

export const siteMetadata: Metadata = {
    title: appConfig.name,
    description: appConfig.description,
};
