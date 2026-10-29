import type { Metadata, Viewport } from "next";
import { Inter, Lora } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { appConfig } from "@/config/app";
import { siteMetadata } from "@/config/site";
import { Analytics } from "@vercel/analytics/next";

const loraHeading = Lora({ subsets: ['latin'], variable: '--font-heading' });

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = siteMetadata;

export const viewport: Viewport = { themeColor: "#1b4d37" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html data-scroll-behavior="smooth"
      lang={appConfig.locale.slice(0, 2)}
      suppressHydrationWarning
      className={cn(inter.variable, loraHeading.variable, "h-full", "antialiased")}
    >
      <body className="min-h-full flex flex-col">{children}<Toaster /><Analytics /></body>
    </html>
  );
}
