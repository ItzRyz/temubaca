import type { Metadata } from "next";
import { Inter, Lora } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { appConfig } from "@/config/app";
import { siteMetadata } from "@/config/site";

const loraHeading = Lora({ subsets: ['latin'], variable: '--font-heading' });

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = siteMetadata;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang={appConfig.locale.slice(0, 2)}
      suppressHydrationWarning
      className={cn(inter.variable, loraHeading.variable, "h-full", "antialiased")}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
