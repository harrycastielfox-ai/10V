import { createFileRoute } from "@tanstack/react-router";
import { Alertas } from "./alertas";

function EstatisticasPage() {
  return <Alertas mode="estatisticas" />;
}

export const Route = createFileRoute("/estatisticas")({
  component: EstatisticasPage,
  head: () => ({
    meta: [
      { title: "Estatísticas Operacionais - SIED" },
      {
        name: "description",
        content: "Panorama geral e estatísticas operacionais do SIED.",
      },
    ],
  }),
});
