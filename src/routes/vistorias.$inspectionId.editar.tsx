import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const VehicleInspectionFormPage = lazy(
  () => import("@/features/vistorias/pages/VehicleInspectionFormPage"),
);

export const Route = createFileRoute("/vistorias/$inspectionId/editar")({
  head: () => ({ meta: [{ title: "Editar Vistoria — SIED" }] }),
  component: EditVehicleInspectionRoute,
});

function EditVehicleInspectionRoute() {
  const { inspectionId } = Route.useParams();
  return (
    <Suspense fallback={null}>
      <VehicleInspectionFormPage inspectionId={inspectionId} />
    </Suspense>
  );
}
