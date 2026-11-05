import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { can, type Permission } from "@/lib/permissions";

// auth() re-reads the user from the database (role changes apply at once), and
// a page calls it from the layout, the page and its components. cache() makes
// that one lookup per request.
const currentSession = cache(() => auth());

export async function requireUser() {
  const session = await currentSession();
  if (!session?.user?.id) redirect("/login");
  const { user } = session;
  return { ...user, name: user.name ?? user.email ?? "A colleague" };
}

export async function requirePermission(permission: Permission) {
  const user = await requireUser();
  if (!can(user.role, permission)) redirect("/?denied=1");
  return user;
}
