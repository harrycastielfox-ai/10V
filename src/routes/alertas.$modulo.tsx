import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { AlertasModuloPanel } from "@/components/AlertasModuloPanel";
import { isValidModulo } from "@/lib/alertasInteligentes";

export const Route = createFileRoute("/alertas/$modulo")({
  component: AlertasModuloRoute,
  head: () => ({ meta: [{ title: "Módulo de Alertas - SIED" }] }),
});

function AlertasModuloRoute() {
  const { modulo } = Route.useParams();
  const selectedModule = isValidModulo(modulo) ? modulo : null;

  return (
    <AppLayout>
      <div className="space-y-4">
        <Link
          to="/alertas"
          className="inline-flex items-center gap-2 text-xs font-medium text-emerald-300 transition-colors hover:text-emerald-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Central de Alertas
        </Link>

        {!selectedModule ? (
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Módulo inválido</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              O módulo informado não existe. Use os painéis da Central de Alertas para abrir um
              módulo válido.
            </p>
          </section>
        ) : (
          <AlertasModuloPanel modulo={selectedModule} />
        )}
      </div>
    </AppLayout>
  );
}
