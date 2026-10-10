import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export default function PublicLayout({ children }: LayoutProps<"/">) {
    return (
        <div className="flex min-h-screen flex-col bg-background">
            <SiteHeader />
            <div className="flex-1">{children}</div>
            <SiteFooter />
        </div>
    );
}
