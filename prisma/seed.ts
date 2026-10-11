import { PrismaClient, Role } from "@prisma/client";

const db = new PrismaClient();

// Creates the first Director so someone can sign in and add the rest of the team.
async function main() {
  const email = process.env.BOOTSTRAP_DIRECTOR_EMAIL?.trim().toLowerCase();
  const name = process.env.BOOTSTRAP_DIRECTOR_NAME?.trim() || "Director";
  if (!email) {
    console.log("BOOTSTRAP_DIRECTOR_EMAIL not set — skipping.");
    return;
  }
  await db.user.upsert({
    where: { email },
    create: { email, name, role: Role.DIRECTOR },
    update: { role: Role.DIRECTOR, active: true },
  });
  console.log(`Director ready: ${email}`);
}

main().finally(() => db.$disconnect());
