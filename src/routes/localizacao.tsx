import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { LocalizacaoRouteFallback } from "@/features/localizacao/components/LocalizacaoRouteFallback";

const LocalizacaoModuleFrame = lazy(
  () => import("@/features/localizacao/pages/LocalizacaoModuleFrame"),
);

export const Route = createFileRoute("/localizacao")({
  head: () => ({
    meta: [
      { title: "Contato Operacional — SIED" },
      { name: "description", content: "Planejamento e acompanhamento de diligências externas." },
    ],
  }),
  component: () => (
    <Suspense fallback={<LocalizacaoRouteFallback />}>
      <LocalizacaoModuleFrame />
    </Suspense>
  ),
});
