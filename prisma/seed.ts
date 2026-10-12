import { PrismaClient, Role } from "@prisma/client";
import { TEMPLATES } from "./templates";

const db = new PrismaClient();

// Safe to run on every deploy: everything is created only if missing.
async function main() {
  // First Director, so someone can sign in and add the rest of the team.
  const email = process.env.BOOTSTRAP_DIRECTOR_EMAIL?.trim().toLowerCase();
  const name = process.env.BOOTSTRAP_DIRECTOR_NAME?.trim() || "Director";
  if (email) {
    await db.user.upsert({
      where: { email },
      create: { email, name, role: Role.DIRECTOR },
      update: { role: Role.DIRECTOR, active: true },
    });
    console.log(`Director ready: ${email}`);
  } else {
    console.log("BOOTSTRAP_DIRECTOR_EMAIL not set — skipping Director.");
  }

  // A default discovery-call booking page hosted by the first Director.
  const director = await db.user.findFirst({ where: { role: Role.DIRECTOR, active: true }, orderBy: { createdAt: "asc" } });
  if (director && (await db.bookingLink.count()) === 0) {
    await db.bookingLink.create({
      data: {
        slug: "discovery-call",
        title: "Discovery Call",
        description: "A free 30-minute call to understand your business and how Outset can help.",
        hostId: director.id,
        isDefault: true,
      },
    });
    console.log("Booking link added: /book/discovery-call");
  }

  // Internal client for the firm's own admin work.
  if (!(await db.client.findFirst({ where: { isInternal: true } }))) {
    await db.client.create({ data: { name: "Outset (Internal)", isInternal: true, entityType: "OTHER" } });
  }

  for (const t of TEMPLATES) {
    if (await db.projectTemplate.findUnique({ where: { name: t.name } })) continue;
    await db.projectTemplate.create({
      data: {
        name: t.name,
        description: t.description,
        tasks: {
          create: t.tasks.map((task, i) => ({
            title: task.title,
            dueOffsetDays: task.due,
            estimateMinutes: task.est,
            priority: task.priority ?? "MEDIUM",
            position: i,
          })),
        },
      },
    });
    const created = await db.projectTemplate.findUniqueOrThrow({ where: { name: t.name }, include: { tasks: true } });
    for (const [i, task] of t.tasks.entries()) {
      if (!task.subtasks) continue;
      const parent = created.tasks.find((x) => x.position === i)!;
      await db.templateTask.createMany({
        data: task.subtasks.map((title, j) => ({ templateId: created.id, parentId: parent.id, title, dueOffsetDays: task.due, position: j })),
      });
    }
    console.log(`Template added: ${t.name}`);
  }
}

main().finally(() => db.$disconnect());
