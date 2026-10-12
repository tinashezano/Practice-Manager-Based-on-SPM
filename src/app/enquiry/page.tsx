import { CheckCircle2 } from "lucide-react";
import { PublicShell } from "@/components/public/shell";
import { Card } from "@/components/ui";
import { EnquiryForm } from "./form";

export const metadata = { title: "Get in touch" };

export default async function EnquiryPage({ searchParams }: { searchParams: Promise<{ sent?: string; embed?: string }> }) {
  const { sent, embed } = await searchParams;
  return (
    <PublicShell embed={!!embed}>
      <Card className="p-6 sm:p-8">
        {sent ? (
          <div className="py-6 text-center">
            <CheckCircle2 size={32} className="mx-auto text-success" />
            <h1 className="mt-3 text-lg font-semibold">Thank you, we&apos;ve received your enquiry</h1>
            <p className="mt-1 text-sm text-muted">Look out for an email from us with a link to book a short discovery call.</p>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-semibold">Let&apos;s talk about your business</h1>
            <p className="mb-6 mt-1 text-sm text-muted">Tell us what you need and we&apos;ll get back to you with a link to book a free discovery call.</p>
            <EnquiryForm embed={!!embed} />
          </>
        )}
      </Card>
    </PublicShell>
  );
}
