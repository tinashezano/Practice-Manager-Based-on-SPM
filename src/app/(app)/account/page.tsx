import { Card, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { ChangePasswordForm } from "./password-form";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const me = await requireUser();
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });

  return (
    <>
      <PageHeader title="My account" subtitle={`${user.name} · ${ROLE_LABELS[user.role]} · ${user.email}`} />
      <Card>
        <h2 className="mb-3 text-sm font-semibold">Password</h2>
        <ChangePasswordForm hasPassword={Boolean(user.passwordHash)} />
      </Card>
    </>
  );
}
