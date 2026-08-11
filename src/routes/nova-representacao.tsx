import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  createRepresentacao,
  replaceRepresentacaoPessoas,
} from "@/lib/repositories/representacoesRepository";
import {
  searchInqueritosForLink,
  type InqueritoLinkOption,
} from "@/lib/repositories/inqueritosRepository";
import { AppLayout } from "@/components/AppLayout";
import { FormFieldLabel } from "@/components/FormFieldLabel";
import { PageHeader } from "@/components/PageHeader";
import { ProceduralStatusSelect, ProceduralTagPicker } from "@/components/ProceduralTagPicker";
import { getCurrentProfile } from "@/lib/auth";
import { canManageProceduralTags, type UserProfile } from "@/lib/authz";
import { canAccessSigilosa } from "@/lib/representacoesSigilo";
import { tagsByScope, type ProceduralTag } from "@/lib/proceduralTags";
import {
  createProceduralTag,
  listProceduralTags,
  replaceMovimentacaoTags,
} from "@/lib/repositories/proceduralTagsRepository";
import {
  RepresentationPeopleEditor,
  type RepresentationPersonFormValue,
} from "@/components/RepresentationPeopleEditor";
import {
  COMPLIANCE_RESULT_DESCRIPTIONS,
  COMPLIANCE_RESULT_OPTIONS,
  COMPLIANCE_STATUS_OPTIONS,
  REPRESENTATION_STATUS_OPTIONS,
  REPRESENTATION_TYPE_OPTIONS,
  isYesValue,
  normalizePriority,
  normalizeRepresentationType,
  representationRequiresCompliance,
  representationRequiresDeadline,
  representationRequiresDecisionNotes,
  representationRequiresJudicialSubmission,
  type ComplianceResult,
  type ComplianceStatus,
  type SelectOption,
} from "@/lib/operationalContracts";

export const Route = createFileRoute("/nova-representacao")({
  head: () => ({ meta: [{ title: "Cadastrar Movimentação Processual — SIPI" }] }),
  component: NovaRepresentacao,
});

const INQUIRY_LINK_OPTIONS: readonly SelectOption[] = [
  { value: "", label: "A definir" },
  { value: "sim", label: "Sim, possui procedimento vinculado" },
  { value: "nao", label: "Não possui procedimento vinculado" },
];
const normalizeText = (value?: string) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const getStatusHint = (status?: string) => {
  const n = normalizeText(status);
  if (!n) return "Selecione o status para orientar a tramitação judicial.";
  if (n.includes("indefer")) return "Status com decisão judicial de indeferimento.";
  if (n.includes("cumprida parcialmente"))
    return "Medida parcialmente cumprida; registre resultado e observações.";
  if (n.includes("cumprid")) return "Medida cumprida; registre resultado e equipe.";
  if (n.includes("defer")) return "Status com decisão judicial favorável.";
  if (n.includes("aguard") || n.includes("analis"))
    return "Representação aguardando manifestação judicial.";
  if (n.includes("enviad")) return "Representação já enviada ao Judiciário.";
  return "Status em acompanhamento interno.";
};

function NovaRepresentacao() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [erro, setErro] = useState("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tagOptions, setTagOptions] = useState<ProceduralTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [statusTagId, setStatusTagId] = useState("");

  const [ppe, setPpe] = useState("");
  const [vinculoInquerito, setVinculoInquerito] = useState<"sim" | "nao" | "">("");
  const [inqueritoId, setInqueritoId] = useState<string | null>(null);
  const [inqueritoMatches, setInqueritoMatches] = useState<InqueritoLinkOption[]>([]);
  const [searchingInquerito, setSearchingInquerito] = useState(false);
  const [justificativaSemInquerito, setJustificativaSemInquerito] = useState("");
  const [processo, setProcesso] = useState("");
  const [tipoRepresentacao, setTipoRepresentacao] = useState("");
  const [tipoOutra, setTipoOutra] = useState("");
  const [dataRepresentacao, setDataRepresentacao] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [vitima, setVitima] = useState("");
  const [investigado, setInvestigado] = useState("");
  const [autorPreso, setAutorPreso] = useState("");
  const [pessoasAdicionais, setPessoasAdicionais] = useState<RepresentationPersonFormValue[]>([]);
  const [resumoFatos, setResumoFatos] = useState("");
  const [fundamentacao, setFundamentacao] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [diligenciasRelacionadas, setDiligenciasRelacionadas] = useState("");
  const [status, setStatus] = useState("");
  const [dataEnvioJudiciario, setDataEnvioJudiciario] = useState("");
  const [dataDecisaoJudicial, setDataDecisaoJudicial] = useState("");
  const [varaJuizo, setVaraJuizo] = useState("");
  const [prazoConcedidoDias, setPrazoConcedidoDias] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [observacoesDecisao, setObservacoesDecisao] = useState("");
  const [dataCumprimento, setDataCumprimento] = useState("");
  const [cumprimentoStatus, setCumprimentoStatus] = useState<ComplianceStatus>("pendente");
  const [equipeCumprimento, setEquipeCumprimento] = useState("");
  const [resultadoCumprimento, setResultadoCumprimento] = useState("");
  const [observacoesCumprimento, setObservacoesCumprimento] = useState("");
  const [prioridadeOperacional, setPrioridadeOperacional] = useState("");
  const [pedidoSigiloso, setPedidoSigiloso] = useState("");
  const [observacoesInternas, setObservacoesInternas] = useState("");
  const [equipeResponsavel, setEquipeResponsavel] = useState("");
  const [acompanhamentoEspecial, setAcompanhamentoEspecial] = useState("");

  const typeTagOptions = useMemo(() => tagsByScope(tagOptions, "movimentacao_tipo"), [tagOptions]);
  const priorityTagOptions = useMemo(() => tagsByScope(tagOptions, "prioridade"), [tagOptions]);
  const statusTagOptions = useMemo(
    () => tagsByScope(tagOptions, "movimentacao_status"),
    [tagOptions],
  );

  useEffect(() => {
    let active = true;
    void Promise.all([
      getCurrentProfile(),
      listProceduralTags([
        "movimentacao_tipo",
        "movimentacao_status",
        "prioridade",
        "movimentacao_geral",
      ]),
    ])
      .then(([currentProfile, tags]) => {
        if (!active) return;
        setProfile(currentProfile);
        setTagOptions(tags);
        const defaultStatus = tags.find(
          (tag) => tag.scope === "movimentacao_status" && tag.slug === "em-analise",
        );
        if (defaultStatus) setStatusTagId(defaultStatus.id);
        const requestedTypeSlug = new URLSearchParams(window.location.search).get("tipo")?.trim();
        const requestedType = requestedTypeSlug
          ? tags.find(
              (tag) =>
                tag.scope === "movimentacao_tipo" && tag.slug === requestedTypeSlug && tag.active,
            )
          : null;
        if (requestedType) {
          setSelectedTagIds((current) => [...new Set([...current, requestedType.id])]);
        }
      })
      .catch((error) => {
        console.warn("[movimentacoes:tags] Catálogo temporariamente indisponível", error);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linkedInquiryId = params.get("inqueritoId")?.trim();
    if (!linkedInquiryId) return;
    setVinculoInquerito("sim");
    setInqueritoId(linkedInquiryId);
    setPpe(params.get("ppe")?.trim() ?? "");
  }, []);

  const exibeCampoOutra = tipoRepresentacao === "Outra";
  const exibeDataEnvioEVara = useMemo(
    () => representationRequiresJudicialSubmission(status),
    [status],
  );
  const exibeDecisaoEPrazo = useMemo(() => representationRequiresDeadline(status), [status]);
  const exibeBlocoCumprimento = useMemo(
    () => representationRequiresCompliance(status, cumprimentoStatus),
    [cumprimentoStatus, status],
  );
  const exibeDecisaoEObservacoes = useMemo(
    () => representationRequiresDecisionNotes(status),
    [status],
  );

  useEffect(() => {
    const normalizedPpe = ppe.trim();
    if (vinculoInquerito !== "sim" || inqueritoId || normalizedPpe.length < 2) {
      setInqueritoMatches([]);
      setSearchingInquerito(false);
      return;
    }

    let isCurrent = true;
    const timer = window.setTimeout(() => {
      setSearchingInquerito(true);
      void searchInqueritosForLink(normalizedPpe)
        .then((matches) => {
          if (isCurrent) setInqueritoMatches(matches);
        })
        .catch(() => {
          if (isCurrent) setInqueritoMatches([]);
        })
        .finally(() => {
          if (isCurrent) setSearchingInquerito(false);
        });
    }, 350);

    return () => {
      isCurrent = false;
      window.clearTimeout(timer);
    };
  }, [inqueritoId, ppe, vinculoInquerito]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setErro("");
    setFeedback("");

    const selectedTypes = typeTagOptions.filter((tag) => selectedTagIds.includes(tag.id));
    if (!statusTagId || selectedTypes.length === 0) {
      setErro("Selecione ao menos um tipo de protocolo e o status da movimentação.");
      return;
    }
    const selectedPriorities = priorityTagOptions.filter((tag) => selectedTagIds.includes(tag.id));
    const tipoFinal = selectedTypes.map((tag) => tag.name).join("; ");
    setLoading(true);

    try {
      const created = await createRepresentacao({
        inquerito_id: vinculoInquerito === "sim" ? inqueritoId : null,
        justificativa_sem_inquerito:
          vinculoInquerito === "nao" ? justificativaSemInquerito.trim() : null,
        numero_ppe: ppe.trim() || null,
        processo_judicial: processo.trim() || null,
        tipo: tipoFinal.trim() || null,
        tipo_normalizado: normalizeRepresentationType(tipoFinal),
        data_representacao: dataRepresentacao || null,
        data_protocolo: dataRepresentacao || null,
        responsavel: null,
        vitima: null,
        investigado: null,
        autor_preso: null,
        resumo_fatos: null,
        fundamentacao: null,
        objetivo: null,
        diligencias_relacionadas: null,
        status_tag_id: statusTagId,
        status: statusTagOptions.find((tag) => tag.id === statusTagId)?.name || null,
        data_envio_judiciario: null,
        data_decisao_judicial: dataDecisaoJudicial || null,
        vara_juizo: varaJuizo.trim() || null,
        prazo_concedido_dias: prazoConcedidoDias.trim() ? Number(prazoConcedidoDias) : null,
        data_vencimento: dataVencimento || null,
        observacoes_decisao: observacoesDecisao.trim() || null,
        data_cumprimento: dataCumprimento || null,
        cumprimento_status: cumprimentoStatus,
        equipe_cumprimento: equipeCumprimento.trim() || null,
        resultado_cumprimento: resultadoCumprimento.trim() || null,
        observacoes_cumprimento: observacoesCumprimento.trim() || null,
        prioridade_operacional: selectedPriorities[0]
          ? normalizePriority(selectedPriorities[0].name)
          : null,
        equipe_responsavel: null,
        acompanhamento_especial: null,
        pedido_sigiloso: pedidoSigiloso || null,
        pedido_sigiloso_normalizado: pedidoSigiloso ? isYesValue(pedidoSigiloso) : null,
        medida_protetiva_normalizada: normalizeRepresentationType(tipoFinal) === "medida_protetiva",
        observacoes_internas: null,
        observacoes_movimentacao: observacoesInternas.trim() || null,
      });
      let tagsWarning = false;
      try {
        await replaceMovimentacaoTags(created.id, selectedTagIds);
      } catch (tagsError) {
        tagsWarning = true;
        console.warn("[movimentacoes:tags] Registro salvo sem vínculos de tags", tagsError);
      }
      setFeedback(
        tagsWarning
          ? "Movimentação salva, mas as tags precisam ser conferidas."
          : "Movimentação processual salva com sucesso.",
      );
      navigate({ to: "/representacoes" });
    } catch (error) {
      const isRlsError =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error.code === "42501" || error.code === "PGRST301");
      setErro(
        isRlsError
          ? "Permissão negada ao inserir no Supabase (RLS). Verifique as políticas de INSERT da tabela public.representacoes para a chave pública."
          : "Falha ao salvar representação no Supabase.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <PageHeader
        title="Cadastrar Movimentação Processual"
        subtitle="Protocolo e tramitação vinculados a procedimento policial"
        showActions={false}
      />
      <form className="space-y-5 max-w-6xl pb-6" onSubmit={handleSubmit}>
        <SectionCard
          title="Identificação Judicial"
          subtitle="Vinculação processual e dados principais da movimentação."
        >
          <OptionSelect
            label="Possui procedimento vinculado?"
            options={INQUIRY_LINK_OPTIONS}
            value={vinculoInquerito}
            onChange={(value) => {
              const nextValue = value as "sim" | "nao" | "";
              setVinculoInquerito(nextValue);
              if (nextValue === "sim") {
                setJustificativaSemInquerito("");
              } else {
                setInqueritoId(null);
                setPpe("");
                setInqueritoMatches([]);
              }
            }}
            hint="O vínculo formal permite abrir o procedimento relacionado e evita cadastros judiciais isolados."
          />
          {vinculoInquerito === "sim" && (
            <Field
              label="PPE vinculado / Procedimento relacionado"
              placeholder="Ex.: 72921/2025"
              value={ppe}
              onChange={(e) => {
                setPpe(e.target.value);
                setInqueritoId(null);
              }}
            />
          )}
          {vinculoInquerito === "sim" && searchingInquerito && (
            <InfoBox>Consultando procedimentos acessíveis com este PPE...</InfoBox>
          )}
          {vinculoInquerito === "sim" &&
            !searchingInquerito &&
            !inqueritoId &&
            inqueritoMatches.length > 0 && (
              <div className="md:col-span-2 lg:col-span-3 rounded-lg border border-primary/25 bg-card/70 p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-primary">
                  Selecione o procedimento correto
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  {inqueritoMatches.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setInqueritoId(item.id);
                        setPpe(item.numero_ppe ?? ppe);
                        setJustificativaSemInquerito("");
                      }}
                      className="rounded-lg border border-border/70 bg-background px-3 py-2 text-left transition-colors hover:border-primary/60 hover:bg-primary/5"
                    >
                      <span className="block text-sm font-semibold text-foreground">
                        PPE {item.numero_ppe || "não informado"}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {item.tipo_procedimento_normalizado || item.tipo || "Procedimento"} ·{" "}
                        {item.situacao || "Sem situação"} · {item.data_instauracao || "Sem data"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          {vinculoInquerito === "sim" && inqueritoId && (
            <div className="md:col-span-2 lg:col-span-3 flex items-center justify-between gap-3 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-100">
              <span>Vínculo formal confirmado com o procedimento selecionado.</span>
              <button
                type="button"
                onClick={() => setInqueritoId(null)}
                className="font-semibold text-emerald-300 hover:text-emerald-200"
              >
                Alterar vínculo
              </button>
            </div>
          )}
          {vinculoInquerito === "nao" && (
            <TextArea
              label="Justificativa para movimentação sem procedimento vinculado"
              placeholder="Ex.: medida autônoma, procedimento ainda não cadastrado ou vínculo pendente de confirmação."
              value={justificativaSemInquerito}
              onChange={(event) => setJustificativaSemInquerito(event.target.value)}
              required
            />
          )}
          <Field
            label="Processo judicial"
            placeholder="Ex.: 8001619-92.2025.8.05.0111"
            value={processo}
            onChange={(e) => setProcesso(e.target.value)}
          />
          <ProceduralTagPicker
            label="Tipo do protocolo"
            hint="Uma movimentação pode reunir mais de um protocolo."
            options={typeTagOptions}
            value={selectedTagIds}
            onChange={setSelectedTagIds}
            onCreate={async (input) => {
              const created = await createProceduralTag(input);
              setTagOptions((current) => [...current, created]);
              return created;
            }}
            createScope="movimentacao_tipo"
            canCreate={canManageProceduralTags(profile)}
          />
          <Field
            label="Data do protocolo"
            type="date"
            value={dataRepresentacao}
            onChange={(e) => setDataRepresentacao(e.target.value)}
          />
        </SectionCard>

        <SectionCard
          title="Tramitação Judicial"
          subtitle="Acompanhamento da fase judicial, decisão e cumprimento."
        >
          <ProceduralStatusSelect
            label="Status da movimentação"
            options={statusTagOptions}
            value={statusTagId}
            onChange={setStatusTagId}
          />
          <ProceduralTagPicker
            label="Prioridade"
            hint="Classificação operacional para filtros e indicadores."
            options={priorityTagOptions}
            value={selectedTagIds}
            onChange={setSelectedTagIds}
            createScope="prioridade"
            canCreate={false}
          />
          <Select
            label="Sigilo"
            options={canAccessSigilosa(profile) ? ["Sim", "Não"] : ["Não"]}
            value={pedidoSigiloso}
            onChange={setPedidoSigiloso}
          />
          <TextArea
            label="Observações"
            placeholder="Registre decisões, providências e informações relevantes da tramitação..."
            value={observacoesInternas}
            onChange={(event) => setObservacoesInternas(event.target.value)}
          />
        </SectionCard>

        {erro && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {erro}
          </div>
        )}
        {feedback && (
          <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
            {feedback}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Link
            to="/representacoes"
            className="px-5 py-2.5 rounded-lg text-sm border border-border hover:bg-accent"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 shadow-lg shadow-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Salvando..." : "Salvar movimentação"}
          </button>
        </div>
      </form>
    </AppLayout>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border/60 bg-background/70 p-5 lg:p-7">
      <h2 className="text-sm font-bold tracking-[0.2em] text-primary uppercase">{title}</h2>
      {subtitle && <p className="mt-1 mb-5 text-xs text-muted-foreground">{subtitle}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
    </section>
  );
}
function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <FormFieldLabel label={label} />
      <input
        {...props}
        className="w-full bg-card border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
      />
    </div>
  );
}
function TextArea({
  label,
  rows = 4,
  ...props
}: { label: string; rows?: number } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="md:col-span-2 lg:col-span-3">
      <FormFieldLabel label={label} />
      <textarea
        rows={rows}
        {...props}
        className="w-full bg-card border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
      />
    </div>
  );
}
function Select({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <div>
      <FormFieldLabel label={label} />
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full bg-card border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
      >
        <option value="">Selecione…</option>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </div>
  );
}
function OptionSelect({
  label,
  options,
  value,
  onChange,
  hint,
}: {
  label: string;
  options: readonly SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  hint?: string;
}) {
  return (
    <div>
      <FormFieldLabel label={label} hint={hint} />
      <select
        value={value ?? ""}
        onChange={(event) => onChange?.(event.target.value)}
        className="w-full bg-card border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
      >
        {!options.some((option) => option.value === "") && (
          <option value="" disabled>
            Selecione...
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="md:col-span-2 lg:col-span-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
      {children}
    </div>
  );
}
