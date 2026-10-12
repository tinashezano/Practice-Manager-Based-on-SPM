import { Logo } from "@/components/logo";

export function PublicShell({ children, embed = false }: { children: React.ReactNode; embed?: boolean }) {
  return (
    <div className={embed ? "p-4" : "min-h-screen px-4 py-10"}>
      <div className="mx-auto w-full max-w-3xl">
        {!embed && <div className="mb-8 flex justify-center"><Logo /></div>}
        {children}
      </div>
    </div>
  );
}
