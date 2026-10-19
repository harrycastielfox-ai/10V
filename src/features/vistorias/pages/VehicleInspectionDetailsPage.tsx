import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Camera,
  CarFront,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  FileText,
  Gauge,
  History,
  LoaderCircle,
  Pencil,
  ShieldCheck,
  UserRound,
  UsersRound,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppLayout } from "@/components/AppLayout";
import { VehicleInspectionPrintSheet } from "@/components/VehicleInspectionPrintSheet";
import type {
  InspectionPhotoCategory,
  VehicleInspection,
  VehicleInspectionAnswer,
  VehicleInspectionPhoto,
} from "@/features/vistorias/vistoriaTypes";
import {
  getVehicleInspection,
  getVehicleInspectionPdfUrl,
  listVehicleInspectionPhotos,
  listVehicleInspectionVersions,
  type VehicleInspectionVersion,
} from "@/lib/repositories/vistoriasRepository";

const STATUS_LABELS: Record<VehicleInspection["status"], string> = {
  rascunho: "Em elaboração",
  emitido: "Relatório emitido",
  cancelado: "Cancelado",
};

const REASON_LABELS: Record<string, string> = {
  suspeita_adulteracao_sinais: "Suspeita de adulteração de sinais",
  suspeita_clonagem: "Suspeita de clonagem",
  recuperacao_furto_roubo: "Recuperação de furto/roubo",
  trafico_drogas: "Tráfico de drogas",
  acidente: "Acidente",
  local_crime: "Local de crime",
  verificacao: "Verificação",
  condutor_nao_habilitado: "Condutor não habilitado",
  instrumento_crime: "Instrumento de crime",
  veiculo_abandonado: "Veículo abandonado",
  outros: "Outros",
};

const INSTITUTION_LABELS: Record<string, string> = {
  policia_militar: "Polícia Militar",
  policia_civil: "Polícia Civil",
  policia_rodoviaria_federal: "Polícia Rodoviária Federal",
  policia_federal: "Polícia Federal",
  guarda_municipal: "Guarda Municipal",
  outros: "Outros",
};

const YARD_LABELS: Record<string, string> = {
  pericia: "Perícia",
  guincho: "Guincho",
  prf: "PRF",
  detran: "DETRAN",
  delegacia: "Delegacia",
  disep: "DISEP",
  outros: "Outros",
};

const PHOTO_LABELS: Record<InspectionPhotoCategory, string> = {
  veiculo: "Veículo",
  chassi: "Chassi",
  motor: "Motor",
  etiqueta_seguranca: "Etiqueta de segurança",
  placa: "Placa",
  sinal_identificador: "Sinal identificador",
  outros: "Outras evidências",
};

const CHECKLIST_ITEMS = [
  ["estepe", "Estepe"],
  ["chave_de_rodas", "Chave de rodas"],
  ["triangulo", "Triângulo"],
  ["macaco", "Macaco"],
  ["tapetes", "Tapetes"],
  ["chave_crv_crlv", "Chave / CRV / CRLV"],
] as const;

const ASSESSMENT_ITEMS = [
  ["stolen_or_robbed", "Produto de furto ou roubo"],
  ["other_restrictions", "Outras restrições"],
  ["identifier_divergence", "Divergência nos sinais identificadores"],
  ["original_characteristics_identified", "Características originais identificadas"],
  ["obd_examined", "Veículo submetido ao OBD"],
  ["expert_examined", "Veículo periciado"],
  ["tampering_confirmed", "Adulteração de sinais constatada"],
] as const;

const DIVERGENCE_LABELS: Record<string, string> = {
  missing_plate_preserved_identifiers: "Sem placa, com os demais identificadores preservados",
  replaced_plate_preserved_identifiers: "Placa trocada, demais identificadores preservados",
  cloned_vehicle: "Indícios de clonagem",
  obd_vin_divergence: "VIN da central eletrônica diverge do ostentado",
  original_number_recovered: "Numeração original identificada em agregado",
  identifier_number_removed: "Ausência completa de numeração identificadora",
  visible_identifier_tampering: "Adulteração visível por raspagem, implante ou regravação",
  incompatible_part_dates: "Datas de fabricação das peças incompatíveis",
  stolen_aggregate: "Agregado proveniente de veículo furtado ou roubado",
};

const QUESTIONNAIRE_LABELS: Record<string, string> = {
  registered_before_law_13352: "Veículo cadastrado antes da Lei 13.352/2015",
  related_to_drug_trafficking: "Apreensão relacionada ao tráfico de drogas ou crimes afins",
  proceeding_information_unavailable: "Procedência policial não identificada",
  seizure_date_unavailable: "Data da apreensão não identificada",
  judicial_auction_requested: "Juízo oficiado para autorização de leilão",
  detran_infraction_requested: "DETRAN/CIRETRAN oficiado para auto de infração",
  public_notice_requested: "Publicação de edital de notificação solicitada",
  early_disposal_requested: "Alienação antecipada solicitada judicialmente",
  owner_or_insurer_notified: "Proprietário ou seguradora notificado",
  awaiting_public_notice: "Aguardando período de notificação em edital",
  under_judicial_restriction: "Veículo objeto de sindicância ou restrição judicial",
  administrative_occurrence_linked: "Ocorrência administrativa vinculada a IP/TCO",
  authorized_to_circulate: "Veículo autorizado judicialmente a circular",
  available_for_auction: "Veículo disponível para leilão",
};

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "Não informado";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return String(value);
}

function formatDate(value?: string | null, withTime = false) {
  if (!value) return "Não informado";
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/u.test(value) ? `${value}T12:00:00` : value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    ...(withTime ? { timeStyle: "short" } : {}),
  }).format(parsed);
}

function answerLabel(value?: VehicleInspectionAnswer) {
  if (value === "sim") return "Sim";
  if (value === "nao") return "Não";
  return "Não informado";
}

function answerTone(value?: VehicleInspectionAnswer) {
  if (value === "sim") return "border-primary/30 bg-primary/10 text-primary";
  if (value === "nao") return "border-border bg-muted/35 text-muted-foreground";
  return "border-border bg-background/40 text-muted-foreground";
}

export default function VehicleInspectionDetailsPage({ inspectionId }: { inspectionId: string }) {
  const [inspection, setInspection] = useState<VehicleInspection | null>(null);
  const [photos, setPhotos] = useState<VehicleInspectionPhoto[]>([]);
  const [versions, setVersions] = useState<VehicleInspectionVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openingPdf, setOpeningPdf] = useState(false);

  const loadDetails = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [inspectionResult, photoResult, versionResult] = await Promise.all([
        getVehicleInspection(inspectionId),
        listVehicleInspectionPhotos(inspectionId),
        listVehicleInspectionVersions(inspectionId),
      ]);
      if (!inspectionResult) throw new Error("Vistoria não encontrada.");
      setInspection(inspectionResult);
      setPhotos(photoResult);
      setVersions(versionResult);
    } catch {
      setError("Não foi possível carregar os detalhes completos da vistoria.");
    } finally {
      setLoading(false);
    }
  }, [inspectionId]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  const photosByCategory = useMemo(() => {
    const groups = new Map<InspectionPhotoCategory, VehicleInspectionPhoto[]>();
    for (const photo of photos) {
      groups.set(photo.category, [...(groups.get(photo.category) ?? []), photo]);
    }
    return [...groups.entries()];
  }, [photos]);

  async function openPdf() {
    if (!inspection) return;
    if (!inspection.pdf_storage_path) {
      window.print();
      return;
    }
    const pdfWindow = window.open("about:blank", "_blank");
    if (pdfWindow) pdfWindow.opener = null;
    setOpeningPdf(true);
    setError("");
    try {
      const url = await getVehicleInspectionPdfUrl(inspection.pdf_storage_path);
      if (!pdfWindow) throw new Error("Janela bloqueada");
      pdfWindow.location.href = url;
    } catch {
      pdfWindow?.close();
      setError("Não foi possível abrir o PDF desta vistoria.");
    } finally {
      setOpeningPdf(false);
    }
  }

  return (
    <AppLayout module="vistorias">
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        {loading ? (
          <div className="flex min-h-[60vh] items-center justify-center rounded-3xl border border-border bg-card/70">
            <div className="text-center">
              <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-3 text-sm font-semibold text-muted-foreground">
                Carregando relatório completo...
              </p>
            </div>
          </div>
        ) : error && !inspection ? (
          <section className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6">
            <p className="font-bold text-destructive">{error}</p>
            <Link
              to="/vistorias"
              className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-primary"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar às vistorias
            </Link>
          </section>
        ) : inspection ? (
          <>
            <header className="relative overflow-hidden rounded-3xl border border-primary/25 bg-card/90 p-6 shadow-xl shadow-primary/5 lg:p-8">
              <div className="absolute inset-y-0 right-0 w-72 bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--primary)_16%,transparent),transparent_68%)]" />
              <div className="relative">
                <Link
                  to="/vistorias"
                  className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground transition hover:text-primary"
                >
                  <ArrowLeft className="h-4 w-4" /> Central de vistorias
                </Link>
                <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                  <div className="flex min-w-0 items-start gap-4">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
                      <ClipboardCheck className="h-7 w-7" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">
                        Relatório completo · Vistoria veicular
                      </p>
                      <h1 className="mt-1 break-words font-mono text-2xl font-black tracking-tight lg:text-3xl">
                        {inspection.vehicle?.internal_id ||
                          inspection.police_report_number ||
                          "Vistoria"}
                      </h1>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {inspection.vehicle?.brand_model || "Veículo não informado"} ·{" "}
                        {inspection.vehicle?.plate || "Sem placa"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge>{STATUS_LABELS[inspection.status]}</Badge>
                        <Badge>Versão {inspection.current_version}</Badge>
                        <Badge tone={inspection.pdf_sha256 ? "success" : "warning"}>
                          {inspection.pdf_sha256 ? "PDF assinado" : "PDF pendente"}
                        </Badge>
                        <Badge>{photos.length} fotografia(s)</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="grid w-full gap-2 sm:grid-cols-2 xl:w-auto">
                    <button
                      type="button"
                      onClick={() => void openPdf()}
                      disabled={openingPdf}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-black text-primary-foreground shadow-lg shadow-primary/15 transition hover:-translate-y-0.5 hover:bg-primary/90 disabled:opacity-60"
                    >
                      {openingPdf ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                      {inspection.pdf_storage_path ? "Ver PDF" : "Gerar PDF"}
                    </button>
                    <Link
                      to="/vistorias/$inspectionId/editar"
                      params={{ inspectionId: inspection.id }}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/35 bg-primary/10 px-5 text-sm font-black text-primary transition hover:-translate-y-0.5 hover:bg-primary/15"
                    >
                      <Pencil className="h-4 w-4" /> Editar vistoria
                    </Link>
                  </div>
                </div>
              </div>
            </header>

            {error ? (
              <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm font-semibold text-destructive">
                {error}
              </p>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
              <div className="space-y-6">
                <DetailSection
                  number="01"
                  title="Apresentação e custódia"
                  subtitle="Origem da ocorrência e situação do veículo"
                  icon={<ShieldCheck className="h-5 w-5" />}
                >
                  <DetailGrid>
                    <DetailField
                      label="B.O. / ocorrência"
                      value={inspection.police_report_number}
                    />
                    <DetailField
                      label="Data da vistoria"
                      value={formatDate(inspection.inspection_date)}
                    />
                    <DetailField
                      label="Motivo da apresentação"
                      value={
                        inspection.presentation_reason
                          ? REASON_LABELS[inspection.presentation_reason]
                          : null
                      }
                    />
                    <DetailField
                      label="Instituição apresentante"
                      value={
                        inspection.presenting_institution
                          ? INSTITUTION_LABELS[inspection.presenting_institution]
                          : null
                      }
                    />
                    <DetailField label="Local da vistoria" value={inspection.location} />
                    <DetailField
                      label="Pátio / destino"
                      value={inspection.yard_type ? YARD_LABELS[inspection.yard_type] : null}
                    />
                    <DetailField label="Local do pátio" value={inspection.yard_location} />
                    <DetailField
                      label="Restrição de entrega"
                      value={inspection.delivery_restricted ? "Sim" : "Não"}
                    />
                  </DetailGrid>
                </DetailSection>

                <DetailSection
                  number="02"
                  title="Identificação do veículo"
                  subtitle="Comparação entre a condição ostentada e o cadastro original vinculado"
                  icon={<CarFront className="h-5 w-5" />}
                >
                  <p className="mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-primary">
                    Características ostentadas / como chegou
                  </p>
                  <DetailGrid>
                    <DetailField
                      label="Tipo ostentado"
                      value={inspection.findings?.ostensible_vehicle?.vehicle_type}
                    />
                    <DetailField
                      label="Marca ostentada"
                      value={inspection.findings?.ostensible_vehicle?.brand}
                    />
                    <DetailField
                      label="Modelo ostentado"
                      value={inspection.findings?.ostensible_vehicle?.model}
                    />
                    <DetailField
                      label="Cor ostentada"
                      value={inspection.findings?.ostensible_vehicle?.color}
                    />
                    <DetailField
                      label="Placa ostentada"
                      value={inspection.findings?.ostensible_vehicle?.plate}
                      mono
                    />
                    <DetailField
                      label="Chassi ostentado"
                      value={inspection.findings?.ostensible_vehicle?.chassis}
                      mono
                    />
                    <DetailField
                      label="Motor ostentado"
                      value={inspection.findings?.ostensible_vehicle?.engine_number}
                      mono
                    />
                    <DetailField
                      label="Renavam ostentado"
                      value={inspection.findings?.ostensible_vehicle?.renavam}
                      mono
                    />
                    <DetailField
                      label="Ano de fabricação"
                      value={inspection.findings?.ostensible_vehicle?.manufacture_year}
                    />
                    <DetailField
                      label="Ano do modelo"
                      value={inspection.findings?.ostensible_vehicle?.model_year}
                    />
                    <DetailField
                      label="Descrição da chegada"
                      value={inspection.findings?.ostensible_vehicle?.description}
                    />
                  </DetailGrid>

                  <p className="mb-3 mt-6 border-t border-border pt-5 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                    Dados originais do cadastro vinculado
                  </p>
                  <DetailGrid>
                    <DetailField
                      label="Cadastro SIED"
                      value={
                        inspection.original_vehicle_data.internal_id ??
                        inspection.vehicle?.internal_id
                      }
                    />
                    <DetailField
                      label="Marca"
                      value={inspection.original_vehicle_data.brand ?? inspection.vehicle?.brand}
                    />
                    <DetailField
                      label="Modelo"
                      value={inspection.original_vehicle_data.model ?? inspection.vehicle?.model}
                    />
                    <DetailField
                      label="Cor"
                      value={inspection.original_vehicle_data.color ?? inspection.vehicle?.color}
                    />
                    <DetailField
                      label="Placa"
                      value={inspection.original_vehicle_data.plate ?? inspection.vehicle?.plate}
                      mono
                    />
                    <DetailField
                      label="Chassi"
                      value={
                        inspection.original_vehicle_data.chassis ?? inspection.vehicle?.chassis
                      }
                      mono
                    />
                    <DetailField
                      label="Motor"
                      value={
                        inspection.original_vehicle_data.engine_number ??
                        inspection.vehicle?.engine_number
                      }
                      mono
                    />
                    <DetailField
                      label="Renavam"
                      value={
                        inspection.original_vehicle_data.renavam ?? inspection.vehicle?.renavam
                      }
                      mono
                    />
                    <DetailField
                      label="Ano de fabricação"
                      value={
                        inspection.original_vehicle_data.manufacture_year ??
                        inspection.vehicle?.manufacture_year
                      }
                    />
                    <DetailField
                      label="Ano do modelo"
                      value={
                        inspection.original_vehicle_data.model_year ??
                        inspection.vehicle?.model_year
                      }
                    />
                    <DetailField
                      label="Conservação cadastrada"
                      value={
                        inspection.original_vehicle_data.conservation_state ??
                        inspection.vehicle?.conservation_state
                      }
                    />
                  </DetailGrid>
                </DetailSection>

                <DetailSection
                  number="03"
                  title="Checklist e condições técnicas"
                  subtitle="Itens presentes, leitura operacional e avarias"
                  icon={<Wrench className="h-5 w-5" />}
                >
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {CHECKLIST_ITEMS.map(([key, label]) => {
                      const value = inspection.checklist?.[key] ?? "nao_informado";
                      return (
                        <div
                          key={key}
                          className={`rounded-xl border p-4 ${
                            value === "presente"
                              ? "border-success/30 bg-success/10"
                              : value === "ausente"
                                ? "border-destructive/30 bg-destructive/10"
                                : "border-border bg-muted/20"
                          }`}
                        >
                          <p className="text-xs font-black">{label}</p>
                          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {value === "presente"
                              ? "Presente"
                              : value === "ausente"
                                ? "Ausente"
                                : "Não informado"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <MetricField
                      label="Nível do óleo"
                      value={inspection.checklist?.technical?.oil_level?.replaceAll("_", " ")}
                    />
                    <MetricField
                      label="Rodas / aro"
                      value={[
                        inspection.checklist?.technical?.wheel_brand,
                        inspection.checklist?.technical?.wheel_rim
                          ? `aro ${inspection.checklist.technical.wheel_rim}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    />
                    <MetricField
                      label="Quilometragem"
                      value={
                        inspection.checklist?.technical?.mileage_km != null
                          ? `${inspection.checklist.technical.mileage_km.toLocaleString("pt-BR")} km`
                          : null
                      }
                    />
                    <MetricField
                      label="Combustível"
                      value={inspection.checklist?.technical?.fuel_level?.replaceAll("_", " ")}
                    />
                    <MetricField
                      label="Estado operacional"
                      value={inspection.checklist?.technical?.vehicle_condition?.replaceAll(
                        "_",
                        " ",
                      )}
                    />
                    <MetricField
                      label="Avarias aparentes"
                      value={inspection.checklist?.technical?.damage_notes}
                    />
                  </div>
                </DetailSection>

                <DetailSection
                  number="04"
                  title="Exame e diagnóstico"
                  subtitle="Respostas técnicas e indícios selecionados"
                  icon={<Gauge className="h-5 w-5" />}
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    {ASSESSMENT_ITEMS.map(([key, label]) => {
                      const value = inspection.checklist?.technical?.assessment?.[key];
                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background/45 p-4"
                        >
                          <span className="text-sm font-semibold">{label}</span>
                          <span
                            className={`shrink-0 rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${answerTone(value)}`}
                          >
                            {answerLabel(value)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {(inspection.checklist?.technical?.assessment?.divergence_indicators?.length ??
                    0) > 0 ? (
                    <div className="mt-4 rounded-xl border border-warning/30 bg-warning/5 p-4">
                      <h3 className="text-xs font-black uppercase tracking-[0.14em] text-warning">
                        Indícios apontados
                      </h3>
                      <ul className="mt-3 space-y-2">
                        {inspection.checklist?.technical?.assessment?.divergence_indicators?.map(
                          (indicator) => (
                            <li
                              key={indicator}
                              className="flex items-start gap-2 text-sm leading-6 text-muted-foreground"
                            >
                              <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-warning" />
                              {DIVERGENCE_LABELS[indicator] ?? indicator}
                            </li>
                          ),
                        )}
                      </ul>
                    </div>
                  ) : null}
                </DetailSection>

                <DetailSection
                  number="05"
                  title="Constatações e resultado"
                  subtitle="Narrativa integral preservada nesta versão"
                  icon={<FileText className="h-5 w-5" />}
                >
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Narrative
                      title="Identificação e sinais"
                      value={inspection.findings?.identification}
                    />
                    <Narrative
                      title="Estrutura e integridade"
                      value={inspection.findings?.structure}
                    />
                    <Narrative title="Conservação" value={inspection.findings?.conservation} />
                    <Narrative title="Acessórios" value={inspection.findings?.accessories} />
                    <Narrative
                      title="Resultado obtido"
                      value={inspection.findings?.result}
                      featured
                    />
                    <Narrative
                      title="Providências adotadas"
                      value={inspection.findings?.measures_taken}
                      featured
                    />
                    <Narrative
                      title="Observações do vistoriador"
                      value={inspection.inspector_notes}
                      wide
                    />
                  </div>
                </DetailSection>

                {Object.entries(inspection.checklist?.technical?.assessment?.questionnaire ?? {})
                  .length ? (
                  <DetailSection
                    number="06"
                    title="Situação administrativa"
                    subtitle="Questionário de destinação e providências"
                    icon={<ClipboardCheck className="h-5 w-5" />}
                  >
                    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                      {Object.entries(
                        inspection.checklist?.technical?.assessment?.questionnaire ?? {},
                      ).map(([key, value]) => (
                        <div
                          key={key}
                          className="flex flex-col gap-2 bg-background/40 p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span className="text-sm font-semibold">
                            {QUESTIONNAIRE_LABELS[key] ?? key}
                          </span>
                          <span
                            className={`w-fit rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${answerTone(value)}`}
                          >
                            {answerLabel(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </DetailSection>
                ) : null}
              </div>

              <aside className="space-y-6">
                <section className="overflow-hidden rounded-2xl border border-border bg-card/80">
                  <div className="flex items-center justify-between border-b border-border p-5">
                    <div>
                      <h2 className="font-black">Registro fotográfico</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {photos.length} evidência(s) vinculada(s)
                      </p>
                    </div>
                    <Camera className="h-5 w-5 text-primary" />
                  </div>
                  <div className="space-y-5 p-4">
                    {photosByCategory.length ? (
                      photosByCategory.map(([category, categoryPhotos]) => (
                        <div key={category}>
                          <div className="mb-2 flex items-center justify-between">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-primary">
                              {PHOTO_LABELS[category]}
                            </h3>
                            <span className="text-[10px] font-bold text-muted-foreground">
                              {categoryPhotos.length}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {categoryPhotos.map((photo) =>
                              photo.vehicle_photo?.thumbnail_url ? (
                                <a
                                  key={photo.id}
                                  href={
                                    photo.vehicle_photo.original_url ??
                                    photo.vehicle_photo.thumbnail_url
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className="group relative overflow-hidden rounded-xl border border-border bg-muted"
                                >
                                  <img
                                    src={photo.vehicle_photo.thumbnail_url}
                                    alt={photo.caption || PHOTO_LABELS[photo.category]}
                                    loading="lazy"
                                    className="aspect-[4/3] h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                  />
                                  <span className="absolute bottom-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-lg bg-black/70 text-white">
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </span>
                                </a>
                              ) : null,
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
                        <Camera className="mx-auto h-6 w-6 text-muted-foreground" />
                        <p className="mt-2 text-xs font-semibold text-muted-foreground">
                          Nenhuma fotografia vinculada.
                        </p>
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-2xl border border-border bg-card/80 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-black">Pessoas vinculadas</h2>
                      <p className="mt-1 text-xs text-muted-foreground">Participantes informados</p>
                    </div>
                    <UsersRound className="h-5 w-5 text-primary" />
                  </div>
                  {inspection.linked_people?.length ? (
                    <ul className="mt-4 space-y-2">
                      {inspection.linked_people.map((person, index) => (
                        <li
                          key={`${person}-${index}`}
                          className="flex items-center gap-3 rounded-xl border border-border bg-background/45 p-3 text-sm font-semibold"
                        >
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                            <UserRound className="h-4 w-4" />
                          </span>
                          <span className="break-words">{person}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-4 text-sm text-muted-foreground">Nenhuma pessoa informada.</p>
                  )}
                </section>

                <section className="rounded-2xl border border-border bg-card/80 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-black">Histórico de versões</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Rastreabilidade do relatório
                      </p>
                    </div>
                    <History className="h-5 w-5 text-primary" />
                  </div>
                  <ol className="mt-4 space-y-3">
                    {versions.map((version) => (
                      <li
                        key={version.id}
                        className="relative rounded-xl border border-border bg-background/45 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black">Versão {version.version}</p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              {version.change_reason ||
                                (version.version === 1
                                  ? "Criação da vistoria"
                                  : "Revisão do relatório")}
                            </p>
                          </div>
                          {version.pdf_sha256 ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                          ) : (
                            <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                        </div>
                        <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {formatDate(version.created_at, true)}
                        </p>
                      </li>
                    ))}
                  </ol>
                </section>

                <section className="rounded-2xl border border-border bg-card/80 p-5">
                  <h2 className="font-black">Rastreabilidade</h2>
                  <dl className="mt-4 space-y-3 text-xs">
                    <TraceRow label="Criada em" value={formatDate(inspection.created_at, true)} />
                    <TraceRow
                      label="Atualizada em"
                      value={formatDate(inspection.updated_at, true)}
                    />
                    <TraceRow label="Versão vigente" value={String(inspection.current_version)} />
                    <TraceRow
                      label="Integridade do PDF"
                      value={inspection.pdf_sha256 ? "Hash SHA-256 registrado" : "Pendente"}
                    />
                  </dl>
                </section>
              </aside>
            </div>

            <VehicleInspectionPrintSheet inspection={inspection} photos={photos} />
          </>
        ) : null}
      </div>
    </AppLayout>
  );
}

function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "success" | "warning";
}) {
  const className =
    tone === "success"
      ? "border-success/30 bg-success/10 text-success"
      : tone === "warning"
        ? "border-warning/30 bg-warning/10 text-warning"
        : "border-primary/25 bg-primary/10 text-primary";
  return (
    <span
      className={`rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${className}`}
    >
      {children}
    </span>
  );
}

function DetailSection({
  number,
  title,
  subtitle,
  icon,
  children,
}: {
  number: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card/80 shadow-sm">
      <header className="flex items-center gap-4 border-b border-border bg-muted/20 px-5 py-4">
        <span className="font-mono text-xs font-black text-primary">{number}</span>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
          {icon}
        </span>
        <div>
          <h2 className="font-black tracking-tight">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function DetailGrid({ children }: { children: ReactNode }) {
  return <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>;
}

function DetailField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: unknown;
  mono?: boolean;
}) {
  const displayed = displayValue(value);
  return (
    <div className="min-w-0 rounded-xl border border-border bg-background/45 p-4">
      <dt className="text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className={`mt-1.5 break-words text-sm font-bold ${mono ? "font-mono" : ""}`}>
        {displayed}
      </dd>
    </div>
  );
}

function MetricField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4">
      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 text-sm font-bold capitalize">{value?.trim() || "Não informado"}</p>
    </div>
  );
}

function Narrative({
  title,
  value,
  featured = false,
  wide = false,
}: {
  title: string;
  value?: string | null;
  featured?: boolean;
  wide?: boolean;
}) {
  return (
    <article
      className={`min-h-32 rounded-xl border p-4 ${featured ? "border-primary/30 bg-primary/5" : "border-border bg-background/45"} ${wide ? "lg:col-span-2" : ""}`}
    >
      <h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-primary">{title}</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
        {value?.trim() || "Não informado"}
      </p>
    </article>
  );
}

function TraceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-bold">{value}</dd>
    </div>
  );
}
