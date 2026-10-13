import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CarFront,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileClock,
  ShieldCheck,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";

export const Route = createFileRoute("/vistorias")({
  head: () => ({
    meta: [
      { title: "Relatórios de Vistoria — SIPI" },
      {
        name: "description",
        content: "Vistorias de veículos com histórico, versões e rastreabilidade.",
      },
    ],
  }),
  component: VistoriasRoute,
});

function VistoriasRoute() {
  return (
    <AppLayout module="vistorias">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card/80 p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
              <ClipboardCheck className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">
                Módulo operacional
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight lg:text-3xl">
                Relatório de Vistoria
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Registre a vistoria do veículo e mantenha cada versão do relatório vinculada ao
                cadastro, ao responsável e ao histórico de alterações.
              </p>
            </div>
          </div>
          <Link
            to="/veiculos"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/15 transition hover:bg-primary/90"
          >
            <CarFront className="h-4 w-4" aria-hidden="true" />
            Selecionar veículo
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </header>

        <section className="grid gap-4 md:grid-cols-3" aria-label="Resumo das vistorias">
          <SummaryCard
            icon={FileCheck2}
            label="Relatórios emitidos"
            value="—"
            hint="Aguardando o primeiro registro"
            tone="text-primary"
          />
          <SummaryCard
            icon={FileClock}
            label="Em revisão"
            value="—"
            hint="As versões ficam preservadas"
            tone="text-warning"
          />
          <SummaryCard
            icon={ShieldCheck}
            label="Rastreabilidade"
            value="Ativa"
            hint="Autor, data e versão em cada alteração"
            tone="text-success"
          />
        </section>

        <section className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
            <ClipboardCheck className="h-7 w-7" aria-hidden="true" />
          </div>
          <h2 className="mt-5 text-lg font-bold">Nenhum relatório de vistoria registrado</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Comece pelo cadastro de veículos. O próximo passo do fluxo cria o relatório, gera o
            PDF e grava a versão com histórico no banco de dados.
          </p>
          <Link
            to="/veiculos"
            className="mt-6 inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold transition hover:bg-accent"
          >
            Abrir cadastro de veículos
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>
      </div>
    </AppLayout>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof FileCheck2;
  label: string;
  value: string;
  hint: string;
  tone: string;
}) {
  return (
    <article className="rounded-2xl border border-border bg-card/80 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50 ${tone}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="text-2xl font-black tracking-tight">{value}</span>
      </div>
      <p className="mt-4 text-sm font-bold">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </article>
  );
}
