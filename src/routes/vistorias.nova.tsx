import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const VehicleInspectionFormPage = lazy(
  () => import("@/features/vistorias/pages/VehicleInspectionFormPage"),
);

export const Route = createFileRoute("/vistorias/nova")({
  head: () => ({ meta: [{ title: "Nova Vistoria — SIED" }] }),
  component: () => (
    <Suspense fallback={null}>
      <VehicleInspectionFormPage hideNavigation />
    </Suspense>
  ),
});
