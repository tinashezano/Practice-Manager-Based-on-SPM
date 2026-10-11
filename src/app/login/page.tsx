import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { auth, devLoginEnabled, signIn } from "@/auth";
import { Logo } from "@/components/logo";
import { Button, Card, inputClass } from "@/components/ui";

export const metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  domain: "Please sign in with your Outset Google Workspace account.",
  "not-invited": "Your account hasn't been added yet. Ask a Director to add you under Team & Roles.",
  CredentialsSignin: "No active staff member with that email.",
  AccessDenied: "Access denied.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await auth();
  if (session?.user) redirect("/");
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <h1 className="text-center text-lg font-semibold">Sign in to Outset PM</h1>
        <p className="mt-1 text-center text-sm text-muted">Use your Google Workspace account.</p>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{ERRORS[error] ?? "Sign-in failed."}</p>
        )}

        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <Button className="w-full">Continue with Google</Button>
        </form>

        {devLoginEnabled && (
          <form
            className="mt-6 space-y-2 border-t border-border pt-6"
            action={async (formData) => {
              "use server";
              try {
                await signIn("dev", { email: formData.get("email"), redirectTo: "/" });
              } catch (e) {
                if (e instanceof AuthError) redirect(`/login?error=${e.type}`);
                throw e;
              }
            }}
          >
            <p className="text-xs font-medium text-muted">Development login</p>
            <input name="email" type="email" required placeholder="staff email" className={inputClass} />
            <Button variant="secondary" className="w-full">Sign in (dev)</Button>
          </form>
        )}
      </Card>
    </div>
  );
}
