import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { ObjectRouteFallback } from "@/features/objects/components/ObjectRouteFallback";

const ObjectsModuleFrame = lazy(() => import("@/features/objects/pages/ObjectsModuleFrame"));

export const Route = createFileRoute("/objetos")({
  head: () => ({
    meta: [
      { title: "Objetos Apreendidos — SIED" },
      {
        name: "description",
        content: "Cadastro, custódia e rastreio de objetos apreendidos.",
      },
    ],
  }),
  component: () => (
    <Suspense fallback={<ObjectRouteFallback />}>
      <ObjectsModuleFrame />
    </Suspense>
  ),
});
