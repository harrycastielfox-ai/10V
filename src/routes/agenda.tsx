import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { AgendaRouteFallback } from "@/features/agenda/components/AgendaRouteFallback";

const AgendaModuleFrame = lazy(() => import("@/features/agenda/pages/AgendaModuleFrame"));

export const Route = createFileRoute("/agenda")({
  head: () => ({
    meta: [
      { title: "Agendamento — SIED" },
      {
        name: "description",
        content: "Convocações para oitiva: quem foi chamado, para quando e por qual fato.",
      },
    ],
  }),
  component: () => (
    <Suspense fallback={<AgendaRouteFallback />}>
      <AgendaModuleFrame />
    </Suspense>
  ),
});
