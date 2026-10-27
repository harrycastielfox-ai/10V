import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { VehicleRouteFallback } from "@/features/vehicles/components/VehicleRouteFallback";

const VehicleEditPage = lazy(() => import("@/features/vehicles/pages/VehicleEditPage"));

export const Route = createFileRoute("/veiculos/$vehicleId_/editar")({
  component: () => (
    <Suspense fallback={<VehicleRouteFallback />}>
      <VehicleEditPage />
    </Suspense>
  ),
});
