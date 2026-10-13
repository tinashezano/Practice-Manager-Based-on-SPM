import { PrismaClient, Role } from "@prisma/client";
import { STARTER_PROGRAMME, STARTER_RESOURCES, STARTER_TEMPLATE_LINKS } from "./starter-resources";
import { hashPassword, passwordProblem } from "../src/lib/password";
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
    // First password, only if they don't have one yet (later changes happen in the app).
    const password = process.env.BOOTSTRAP_DIRECTOR_PASSWORD;
    if (password) {
      const problem = passwordProblem(password);
      const director = await db.user.findUniqueOrThrow({ where: { email } });
      if (problem) console.log(`BOOTSTRAP_DIRECTOR_PASSWORD not used: ${problem}`);
      else if (!director.passwordHash) {
        await db.user.update({ where: { email }, data: { passwordHash: await hashPassword(password) } });
        console.log("Director password set.");
      }
    }
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

// Sample catalogue (only if empty). PRICES ARE PLACEHOLDERS: edit them under Proposals → Services.
async function seedServices() {
  if ((await db.service.count()) > 0) return;
  const tpl = async (name: string) => (await db.projectTemplate.findUnique({ where: { name } }))?.id ?? null;
  const services: { name: string; description: string; billingType: "MONTHLY" | "ONCE_OFF"; price: number; template?: string; taxable?: boolean }[] = [
    { name: "Monthly Bookkeeping", description: "Capturing, bank reconciliations and monthly management accounts.", billingType: "MONTHLY", price: 2500, template: "Monthly Bookkeeping" },
    { name: "VAT Returns", description: "VAT201 preparation and eFiling submission every VAT period.", billingType: "MONTHLY", price: 750, template: "VAT201 Return" },
    { name: "Payroll (up to 10 employees)", description: "Monthly payroll, payslips and EMP201 submissions.", billingType: "MONTHLY", price: 1200, template: "EMP201 Payroll Submission" },
    { name: "Onboarding & Setup", description: "Taking over your records, setting up QuickBooks and SARS eFiling access.", billingType: "ONCE_OFF", price: 1500 },
    { name: "Annual Financial Statements", description: "Year-end financial statements and company income tax return (ITR14).", billingType: "ONCE_OFF", price: 8500, template: "Annual Financial Statements" },
    { name: "Company Registration (CIPC)", description: "New company registration through to SARS income tax registration.", billingType: "ONCE_OFF", price: 2500, template: "Company Registration (CIPC)" },
    { name: "CIPC Annual Return", description: "Filing your company's annual return with CIPC.", billingType: "ONCE_OFF", price: 650, template: "CIPC Annual Return" },
  ];
  const ids: Record<string, string> = {};
  for (const [i, sv] of services.entries()) {
    const created = await db.service.create({
      data: { name: sv.name, description: sv.description, billingType: sv.billingType, priceCents: sv.price * 100, taxable: sv.taxable ?? true, templateId: sv.template ? await tpl(sv.template) : null, position: i },
    });
    ids[sv.name] = created.id;
  }
  await db.servicePackage.create({
    data: {
      name: "Small Business Essentials",
      description: "Bookkeeping and VAT for a VAT-registered small business.",
      items: { create: [{ serviceId: ids["Onboarding & Setup"]! }, { serviceId: ids["Monthly Bookkeeping"]! }, { serviceId: ids["VAT Returns"]! }] },
    },
  });
  await db.servicePackage.create({
    data: {
      name: "Startup Launch",
      description: "Register the company and keep the books from day one.",
      items: { create: [{ serviceId: ids["Company Registration (CIPC)"]! }, { serviceId: ids["Monthly Bookkeeping"]! }] },
    },
  });
  console.log("Sample services and packages added (placeholder prices).");
}

// Starter SOPs, template links and a staff onboarding programme (only if the hub is empty).
async function seedResourceHub() {
  if ((await db.resource.count()) > 0) return;
  const director = await db.user.findFirst({ where: { role: Role.DIRECTOR, active: true }, orderBy: { createdAt: "asc" } });
  const ids: Record<string, string> = {};
  for (const r of STARTER_RESOURCES) {
    const created = await db.resource.create({
      data: {
        title: r.title, summary: r.summary, body: r.body, category: r.category, type: r.type, tags: r.tags, status: "PUBLISHED",
        ownerId: director?.id ?? null,
        versions: { create: { version: 1, title: r.title, body: r.body, changeNote: "Starter content", editedById: director?.id ?? null } },
      },
    });
    ids[r.key] = created.id;
  }
  for (const l of STARTER_TEMPLATE_LINKS) {
    await db.templateTask.updateMany({ where: { title: l.task, template: { name: l.template } }, data: { resourceId: ids[l.resource] } });
  }
  await db.programme.create({
    data: {
      name: STARTER_PROGRAMME.name,
      description: STARTER_PROGRAMME.description,
      steps: { create: STARTER_PROGRAMME.steps.map((st, i) => ({ title: st.title, resourceId: st.resource ? ids[st.resource] : null, dueOffsetDays: st.day, estimateMinutes: st.minutes, position: i })) },
    },
  });
  console.log("Starter SOPs and staff onboarding programme added.");
}

main().then(seedServices).then(seedResourceHub).finally(() => db.$disconnect());
