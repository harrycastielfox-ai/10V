import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { BoRouteFallback } from "@/features/bo/components/BoRouteFallback";

const BoFormPage = lazy(() => import("@/features/bo/pages/BoFormPage"));

export const Route = createFileRoute("/bo/novo")({
  component: () => (
    <Suspense fallback={<BoRouteFallback />}>
      <BoFormPage />
    </Suspense>
  ),
});
