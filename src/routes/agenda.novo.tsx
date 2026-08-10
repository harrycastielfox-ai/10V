import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { AgendaRouteFallback } from "@/features/agenda/components/AgendaRouteFallback";

const AgendamentoNovoPage = lazy(() => import("@/features/agenda/pages/AgendamentoNovoPage"));

/** `remarcarDe`: id de um atendimento anterior pra reaproveitar os dados da pessoa. */
type AgendaNovoSearch = {
  remarcarDe?: string;
};

export const Route = createFileRoute("/agenda/novo")({
  validateSearch: (search: Record<string, unknown>): AgendaNovoSearch => {
    const remarcarDe = typeof search.remarcarDe === "string" ? search.remarcarDe : undefined;
    return remarcarDe ? { remarcarDe } : {};
  },
  component: AgendaNovoRoute,
});

function AgendaNovoRoute() {
  const { remarcarDe } = Route.useSearch();
  return (
    <Suspense fallback={<AgendaRouteFallback />}>
      <AgendamentoNovoPage remarcarDeId={remarcarDe} />
    </Suspense>
  );
}
