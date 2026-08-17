import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { BoRouteFallback } from "@/features/bo/components/BoRouteFallback";

const BoOverviewPage = lazy(() => import("@/features/bo/pages/BoOverviewPage"));

export const Route = createFileRoute("/bo/")({
  component: () => (
    <Suspense fallback={<BoRouteFallback />}>
      <BoOverviewPage />
    </Suspense>
  ),
});
