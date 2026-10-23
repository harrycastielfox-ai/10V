import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Network } from "lucide-react";
import NexoWorkspacePage from "@/features/nexo/pages/NexoWorkspacePage";

export const Route = createFileRoute("/preview/nexo")({
  head: () => ({ meta: [{ title: "Pré-visualização NEXO — SIED" }] }),
  component: NexoPreviewPage,
});

function NexoPreviewPage() {
  if (!import.meta.env.DEV) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Pré-visualização disponível somente no ambiente local.
      </div>
    );
  }

  return (
    <div className="nexo-shell min-h-screen bg-[#f1f5f8] text-[#203d53]">
      <div className="sticky top-0 z-40 flex items-center gap-4 border-b border-[#dce8ef] bg-white/95 px-4 py-3 backdrop-blur md:px-8">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#c8e5e9] bg-[#eaf6f8] text-[#21899f]">
          <Network className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block text-sm font-black tracking-[0.2em] text-[#173d5b]">NEXO</strong>
          <small className="block truncate text-[9px] uppercase tracking-wider text-[#7d9dad]">
            Pré-visualização local · dados fictícios
          </small>
        </span>
        <Link
          to="/modulos"
          className="inline-flex items-center gap-2 text-xs font-bold text-[#6c8496] hover:text-[#21899f]"
        >
          <ArrowLeft className="h-4 w-4" /> Módulos
        </Link>
      </div>
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950 md:px-8">
        DEMONSTRAÇÃO: pessoas e vínculos fictícios. Os nomes das organizações são referências
        públicas e não indicam atuação em Itabela/BA.
      </div>
      <main className="min-w-0">
        <NexoWorkspacePage preview />
      </main>
    </div>
  );
}
