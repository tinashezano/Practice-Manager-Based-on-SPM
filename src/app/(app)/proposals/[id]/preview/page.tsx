import { redirect } from "next/navigation";

export default async function OldPreview({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/proposal-preview/${(await params).id}`);
}
