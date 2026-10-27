import { createFileRoute } from "@tanstack/react-router";
import { Alertas } from "@/features/alerts/AlertasPage";

export const Route = createFileRoute("/alertas")({
  component: Alertas,
  head: () => ({ meta: [{ title: "Central Operacional de Pendências - SIED" }] }),
});
