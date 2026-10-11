import { signOut } from "@/auth";
import { Sidebar } from "@/components/sidebar";
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        user={{ name: user.name ?? user.email ?? "", email: user.email ?? "", role: user.role }}
        signOutAction={signOutAction}
      />
      <main className="min-w-0 flex-1 px-8 py-6">{children}</main>
    </div>
  );
}
