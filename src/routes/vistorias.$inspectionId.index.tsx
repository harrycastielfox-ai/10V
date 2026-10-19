import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const VehicleInspectionDetailsPage = lazy(
  () => import("@/features/vistorias/pages/VehicleInspectionDetailsPage"),
);

export const Route = createFileRoute("/vistorias/$inspectionId/")({
  head: () => ({ meta: [{ title: "Detalhes da Vistoria — SIED" }] }),
  component: VehicleInspectionDetailsRoute,
});

function VehicleInspectionDetailsRoute() {
  const { inspectionId } = Route.useParams();
  return (
    <Suspense fallback={null}>
      <VehicleInspectionDetailsPage inspectionId={inspectionId} />
    </Suspense>
  );
}
