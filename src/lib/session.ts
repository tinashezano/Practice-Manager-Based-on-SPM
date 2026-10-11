import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can, type Permission } from "@/lib/permissions";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user;
}

export async function requirePermission(permission: Permission) {
  const user = await requireUser();
  if (!can(user.role, permission)) redirect("/?denied=1");
  return user;
}
