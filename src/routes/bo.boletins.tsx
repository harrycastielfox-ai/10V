import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { BoRouteFallback } from "@/features/bo/components/BoRouteFallback";

const BoListPage = lazy(() => import("@/features/bo/pages/BoListPage"));

type BoListSearch = {
  q?: string;
};

export const Route = createFileRoute("/bo/boletins")({
  validateSearch: (search: Record<string, unknown>): BoListSearch => ({
    q: typeof search.q === "string" && search.q.trim() ? search.q.trim() : undefined,
  }),
  component: () => (
    <Suspense fallback={<BoRouteFallback />}>
      <BoListPage />
    </Suspense>
  ),
});
