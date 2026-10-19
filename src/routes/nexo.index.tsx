import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const NexoWorkspacePage = lazy(() => import("@/features/nexo/pages/NexoWorkspacePage"));

export const Route = createFileRoute("/nexo/")({
  component: () => (
    <Suspense fallback={null}>
      <NexoWorkspacePage />
    </Suspense>
  ),
});
