import type { FilePurpose } from "@prisma/client";
import { db } from "@/lib/db";
import { EXT_TYPES } from "@/lib/file-meta";

export { ACCEPT_ATTR, formatBytes } from "@/lib/file-meta";

// Files are stored in Postgres for now (simple, backed up with the database).
// Everything goes through these helpers, so moving to S3/R2 later only
// changes this file.

export const MAX_FILE_BYTES = 15 * 1024 * 1024;

const ALLOWED: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/heic": "HEIC",
  "image/heif": "HEIF",
  "image/webp": "WebP",
  "text/csv": "CSV",
  "application/vnd.ms-excel": "Excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
  "application/msword": "Word",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/zip": "ZIP",
  "application/x-zip-compressed": "ZIP",
};

/** Browsers sometimes send an empty or generic type; fall back to the extension. */
export function resolveType(name: string, type: string) {
  if (ALLOWED[type]) return type;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TYPES[ext] ?? null;
}

export function validateFile(f: { name: string; type: string; size: number }): string | null {
  if (!f.size) return `${f.name} is empty.`;
  if (f.size > MAX_FILE_BYTES) return `${f.name} is larger than 15 MB.`;
  if (!resolveType(f.name, f.type)) return `${f.name}: please upload PDF, images, Excel, Word, CSV or ZIP files.`;
  return null;
}

export function safeName(name: string) {
  return name.replace(/[^\w.\- ()]/g, "_").slice(0, 150) || "file";
}

export async function saveFile(file: File, opts: { purpose: FilePurpose; uploadedById?: string | null; byClient?: boolean }) {
  const error = validateFile(file);
  if (error) throw new Error(error);
  return db.storedFile.create({
    data: {
      name: safeName(file.name),
      contentType: resolveType(file.name, file.type)!,
      size: file.size,
      data: Buffer.from(await file.arrayBuffer()),
      purpose: opts.purpose,
      uploadedById: opts.uploadedById ?? null,
      uploadedByClient: opts.byClient ?? false,
    },
    select: { id: true, name: true, size: true },
  });
}

