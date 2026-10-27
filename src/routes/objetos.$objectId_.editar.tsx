import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { ObjectRouteFallback } from "@/features/objects/components/ObjectRouteFallback";

const ObjectEditPage = lazy(() => import("@/features/objects/pages/ObjectEditPage"));

export const Route = createFileRoute("/objetos/$objectId_/editar")({
  component: () => (
    <Suspense fallback={<ObjectRouteFallback />}>
      <ObjectEditPage />
    </Suspense>
  ),
});
