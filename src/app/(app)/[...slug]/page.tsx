import { ComingSoon } from "@/components/coming-soon";

// Screens that aren't built yet render a placeholder, so navigation works
// end-to-end from day one. Each real page replaces its entry with a concrete route.
export default async function Placeholder({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return <ComingSoon href={`/${slug.join("/")}`} />;
}
