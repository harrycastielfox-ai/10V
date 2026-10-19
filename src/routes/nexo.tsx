import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const NexoModuleFrame = lazy(() => import("@/features/nexo/pages/NexoModuleFrame"));

export const Route = createFileRoute("/nexo")({
  head: () => ({
    meta: [
      { title: "NEXO — Inteligência de Vínculos — SIED" },
      {
        name: "description",
        content: "Núcleo Estratégico de Vínculos e Organizações do SIED.",
      },
    ],
  }),
  component: () => (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#050a10] text-cyan-200">
          Carregando NEXO…
        </div>
      }
    >
      <NexoModuleFrame />
    </Suspense>
  ),
});
