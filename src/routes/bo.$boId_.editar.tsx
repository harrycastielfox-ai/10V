import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { BoRouteFallback } from "@/features/bo/components/BoRouteFallback";

const BoEditPage = lazy(() => import("@/features/bo/pages/BoEditPage"));

export const Route = createFileRoute("/bo/$boId_/editar")({ component: BoEditRoute });

function BoEditRoute() {
  const { boId } = Route.useParams();
  return (
    <Suspense fallback={<BoRouteFallback />}>
      <BoEditPage boId={boId} />
    </Suspense>
  );
}
