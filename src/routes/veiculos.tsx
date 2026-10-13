import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { VehicleRouteFallback } from "@/features/vehicles/components/VehicleRouteFallback";

const VehiclesModuleFrame = lazy(() => import("@/features/vehicles/pages/VehiclesModuleFrame"));

export const Route = createFileRoute("/veiculos")({
  head: () => ({
    meta: [
      { title: "Veículos Apreendidos — SIED" },
      {
        name: "description",
        content: "Cadastro, identificação, custódia e acompanhamento de veículos apreendidos.",
      },
    ],
  }),
  component: () => (
    <Suspense fallback={<VehicleRouteFallback />}>
      <VehiclesModuleFrame />
    </Suspense>
  ),
});
