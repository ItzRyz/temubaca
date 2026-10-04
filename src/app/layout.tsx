import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Lora } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const loraHeading = Lora({ subsets: ['latin'], variable: '--font-heading' });

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: "TemuBaca",
  description: "Temukan teman baca dan buku di sekitarmu.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={cn(inter.variable, loraHeading.variable, "h-full", "antialiased")}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
