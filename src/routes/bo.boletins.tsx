import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { BoRouteFallback } from "@/features/bo/components/BoRouteFallback";

const BoListPage = lazy(() => import("@/features/bo/pages/BoListPage"));

export const Route = createFileRoute("/bo/boletins")({
  component: () => (
    <Suspense fallback={<BoRouteFallback />}>
      <BoListPage />
    </Suspense>
  ),
});
