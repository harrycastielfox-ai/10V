import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { BoRouteFallback } from "@/features/bo/components/BoRouteFallback";

const BoModuleFrame = lazy(() => import("@/features/bo/pages/BoModuleFrame"));

export const Route = createFileRoute("/bo")({
  head: () => ({
    meta: [
      { title: "Boletim de Ocorrência — SIPI" },
      {
        name: "description",
        content: "Módulo operacional para gestão de boletins de ocorrência.",
      },
    ],
  }),
  component: () => (
    <Suspense fallback={<BoRouteFallback />}>
      <BoModuleFrame />
    </Suspense>
  ),
});
