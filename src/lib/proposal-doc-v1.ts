import { z } from "zod";

// The first proposal document format (fixed sections). Only read now, so
// proposals made with it can be converted to pages and blocks.

const sectionSchema = z.object({
  id: z.string(),
  kind: z.enum(["introduction", "services", "pricing", "documents", "terms", "nextStep", "perks", "thankYou", "custom"]),
  title: z.string(),
  html: z.string().default(""),
  hidden: z.boolean().default(false),
  perks: z.array(z.object({ id: z.string(), title: z.string(), text: z.string() })).default([]),
  files: z.array(z.object({ id: z.string(), name: z.string() })).default([]),
});

export const v1Schema = z.object({
  v: z.literal(1),
  general: z.object({ termMonths: z.number().nullable() }).default({ termMonths: 12 }),
  cover: z
    .object({ heading: z.string(), subtitle: z.string(), tagline: z.string(), preparedBy: z.string(), showLogo: z.boolean() })
    .partial()
    .default({}),
  theme: z.object({ color: z.string(), font: z.string(), logoFileId: z.string().nullable() }).partial().default({}),
  sections: z.array(sectionSchema),
  email: z.object({ subject: z.string(), body: z.string() }).partial().default({}),
});

export type V1Doc = z.infer<typeof v1Schema>;
