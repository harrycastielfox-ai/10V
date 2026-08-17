import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { BoRouteFallback } from "@/features/bo/components/BoRouteFallback";

const BoDetailsPage = lazy(() => import("@/features/bo/pages/BoDetailsPage"));

export const Route = createFileRoute("/bo/$boId")({ component: BoDetailsRoute });

function BoDetailsRoute() {
  const { boId } = Route.useParams();
  return (
    <Suspense fallback={<BoRouteFallback />}>
      <BoDetailsPage boId={boId} />
    </Suspense>
  );
}
