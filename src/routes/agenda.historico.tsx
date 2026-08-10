import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { AgendaRouteFallback } from "@/features/agenda/components/AgendaRouteFallback";

const HistoricoPage = lazy(() => import("@/features/agenda/pages/HistoricoPage"));

export const Route = createFileRoute("/agenda/historico")({
  component: () => (
    <Suspense fallback={<AgendaRouteFallback />}>
      <HistoricoPage />
    </Suspense>
  ),
});
