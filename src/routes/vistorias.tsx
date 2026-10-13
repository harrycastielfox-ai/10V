import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CarFront,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileClock,
  LoaderCircle,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { SipiPrintSheet } from "@/components/SipiPrintSheet";
import {
  attachVehicleInspectionPdf,
  createVehicleInspection,
  listVehicleInspections,
  listVehiclesForInspection,
  uploadVehicleInspectionPdf,
} from "@/lib/repositories/vistoriasRepository";
import type { VehicleInspection } from "@/features/vistorias/vistoriaTypes";

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
  const [inspections, setInspections] = useState<VehicleInspection[]>([]);
  const [vehicles, setVehicles] = useState<
    Array<{ id: string; internal_id: string; brand_model: string | null; plate: string | null }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState("");
  const [inspectionDate, setInspectionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [printInspection, setPrintInspection] = useState<VehicleInspection | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([listVehicleInspections(), listVehiclesForInspection()])
      .then(([inspectionRows, vehicleRows]) => {
        if (cancelled) return;
        setInspections(inspectionRows);
        setVehicles(vehicleRows);
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível carregar os dados de vistoria.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreateInspection() {
    if (!vehicleId) {
      setError("Selecione um veículo antes de salvar a vistoria.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createVehicleInspection({
        vehicle_id: vehicleId,
        inspection_date: inspectionDate,
        location,
        inspector_notes: notes,
      });
      setInspections((current) => [created, ...current]);
      setShowForm(false);
      setVehicleId("");
      setLocation("");
      setNotes("");
    } catch {
      setError("Não foi possível salvar a vistoria. Verifique sua autorização e tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePdfUpload(inspection: VehicleInspection, file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("Selecione um arquivo PDF para anexar ao relatório.");
      return;
    }
    setUploadingId(inspection.id);
    setError(null);
    try {
      const uploaded = await uploadVehicleInspectionPdf(
        inspection.id,
        inspection.current_version,
        file,
      );
      const updated = await attachVehicleInspectionPdf(
        inspection.id,
        inspection.current_version,
        uploaded.path,
        uploaded.pdfSha256,
      );
      if (updated) {
        setInspections((current) =>
          current.map((item) => (item.id === inspection.id ? updated : item)),
        );
      }
    } catch {
      setError("Não foi possível anexar o PDF da vistoria.");
    } finally {
      setUploadingId(null);
    }
  }

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
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/15 transition hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nova vistoria
          </button>
        </header>

        {showForm && (
          <section className="rounded-2xl border border-primary/25 bg-card/90 p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                  Novo registro
                </p>
                <h2 className="mt-1 text-lg font-bold">Dados da vistoria</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Cancelar
              </button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm font-semibold">
                Veículo
                <select
                  value={vehicleId}
                  onChange={(event) => setVehicleId(event.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal"
                >
                  <option value="">Selecione o veículo</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.internal_id} · {vehicle.plate || "sem placa"} ·{" "}
                      {vehicle.brand_model || "não informado"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm font-semibold">
                Data da vistoria
                <input
                  type="date"
                  value={inspectionDate}
                  onChange={(event) => setInspectionDate(event.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal"
                />
              </label>
              <label className="space-y-2 text-sm font-semibold">
                Local
                <input
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="Pátio, unidade ou endereço"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal"
                />
              </label>
              <label className="space-y-2 text-sm font-semibold md:col-span-2">
                Observações do vistoriador
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  placeholder="Descreva somente o que foi observado"
                  className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => void handleCreateInspection()}
              disabled={saving || loading}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {saving ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <ClipboardCheck className="h-4 w-4" />
              )}
              {saving ? "Salvando..." : "Salvar vistoria"}
            </button>
          </section>
        )}

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

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

        <section className="rounded-2xl border border-border bg-card/50 p-6 shadow-sm">
          {loading ? (
            <div className="flex min-h-32 items-center justify-center text-muted-foreground">
              <LoaderCircle className="h-5 w-5 animate-spin" aria-label="Carregando vistorias" />
            </div>
          ) : inspections.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold">Vistorias recentes</h2>
                <span className="text-xs text-muted-foreground">
                  {inspections.length} registro(s)
                </span>
              </div>
              {inspections.map((inspection) => (
                <article
                  key={inspection.id}
                  className="rounded-xl border border-border bg-background/60 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">
                        {inspection.vehicle?.internal_id || "Veículo não informado"}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {inspection.vehicle?.brand_model || "Modelo não informado"} ·{" "}
                        {inspection.vehicle?.plate || "sem placa"}
                      </p>
                    </div>
                    <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                      {inspection.status}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Vistoria em{" "}
                    {new Intl.DateTimeFormat("pt-BR").format(
                      new Date(`${inspection.inspection_date}T12:00:00`),
                    )}{" "}
                    · versão {inspection.current_version}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPrintInspection(inspection);
                        window.setTimeout(() => window.print(), 120);
                      }}
                      className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold transition hover:bg-accent"
                    >
                      Gerar impressão/PDF
                    </button>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/15">
                      {uploadingId === inspection.id ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Anexar PDF assinado
                      <input
                        type="file"
                        accept="application/pdf"
                        className="sr-only"
                        disabled={uploadingId !== null}
                        onChange={(event) => {
                          void handlePdfUpload(inspection, event.target.files?.[0]);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                    {inspection.pdf_sha256 ? (
                      <span className="text-[11px] text-success">
                        PDF anexado · SHA-256 registrado
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">
                        PDF ainda não anexado
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="p-2 text-center">
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
            </div>
          )}
        </section>
        {printInspection ? (
          <SipiPrintSheet
            documentTitle="Relatório de Vistoria Veicular"
            documentSubtitle="Registro operacional de vistoria"
            identifierLabel="ID DA VISTORIA"
            identifier={printInspection.id}
            variant="vehicle"
            summary={[
              { label: "Veículo", value: printInspection.vehicle?.internal_id },
              { label: "Placa", value: printInspection.vehicle?.plate },
              { label: "Data", value: printInspection.inspection_date },
              { label: "Local", value: printInspection.location },
            ]}
            sections={[
              {
                title: "Observações",
                narrative: true,
                fields: [
                  {
                    label: "Registro do vistoriador",
                    value: printInspection.inspector_notes,
                    wide: true,
                    manualLine: true,
                  },
                ],
              },
            ]}
          />
        ) : null}
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
