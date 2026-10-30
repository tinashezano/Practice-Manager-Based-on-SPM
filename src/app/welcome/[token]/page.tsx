import Link from "next/link";
import { Logo } from "@/components/logo";
import { Card } from "@/components/ui";
import { findInvite } from "@/lib/invites";
import { setupAccount } from "./actions";
import { SetupForm } from "./form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set up your account", robots: { index: false } };

export default async function WelcomePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await findInvite(token);
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-6 flex justify-center"><Logo /></div>
        {user ? (
          <>
            <h1 className="text-center text-lg font-semibold">Welcome, {user.name.split(" ")[0]}</h1>
            <p className="mt-1 text-center text-sm text-muted">Choose a password to finish setting up your Outset PM account.</p>
            <SetupForm action={setupAccount.bind(null, token)} email={user.email} />
          </>
        ) : (
          <>
            <h1 className="text-center text-lg font-semibold">This link has expired</h1>
            <p className="mt-2 text-center text-sm text-muted">Invite links work once and expire after 7 days. Ask a Director to send you a new invite.</p>
            <Link href="/login" className="mt-6 block text-center text-sm text-brand">Go to sign in</Link>
          </>
        )}
      </Card>
    </div>
  );
}
