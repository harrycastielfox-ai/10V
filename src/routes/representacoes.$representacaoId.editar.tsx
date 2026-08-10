import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppLayout } from "@/components/AppLayout";
import { FormFieldLabel } from "@/components/FormFieldLabel";
import { PageHeader } from "@/components/PageHeader";
import { ProceduralStatusSelect, ProceduralTagPicker } from "@/components/ProceduralTagPicker";
import {
  RepresentationPeopleEditor,
  type RepresentationPersonFormValue,
} from "@/components/RepresentationPeopleEditor";
import {
  getRepresentacaoById,
  listRepresentacaoPessoas,
  replaceRepresentacaoPessoas,
  updateRepresentacao,
} from "@/lib/repositories/representacoesRepository";
import {
  searchInqueritosForLink,
  type InqueritoLinkOption,
} from "@/lib/repositories/inqueritosRepository";
import { getCurrentProfile } from "@/lib/auth";
import { canEditRepresentacoes, canManageProceduralTags, type UserProfile } from "@/lib/authz";
import { canAccessSigilosa } from "@/lib/representacoesSigilo";
import { tagsByScope, type ProceduralTag } from "@/lib/proceduralTags";
import {
  createProceduralTag,
  listMovimentacaoTagIds,
  listProceduralTags,
  replaceMovimentacaoTags,
} from "@/lib/repositories/proceduralTagsRepository";
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
  representationTypeLabel,
  type ComplianceResult,
  type ComplianceStatus,
  type SelectOption,
} from "@/lib/operationalContracts";

export const Route = createFileRoute("/representacoes/$representacaoId/editar")({
  head: () => ({ meta: [{ title: "Editar Movimentação Processual — SIPI" }] }),
  component: EditarRepresentacao,
});

const INQUIRY_LINK_OPTIONS: readonly SelectOption[] = [
  { value: "", label: "A definir" },
  { value: "sim", label: "Sim, possui procedimento vinculado" },
  { value: "nao", label: "Não possui procedimento vinculado" },
];
const normalizeText = (value?: string | null) =>
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

function EditarRepresentacao() {
  const { representacaoId } = Route.useParams();
  const navigate = useNavigate();
  const showLegacyFields = false;

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [erro, setErro] = useState("");
  const [pessoasCarregadas, setPessoasCarregadas] = useState(true);
  const [naoEncontrada, setNaoEncontrada] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [restricted, setRestricted] = useState(false);
  const [tagOptions, setTagOptions] = useState<ProceduralTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [statusTagId, setStatusTagId] = useState("");

  const [ppe, setPpe] = useState("");
  const [legacyPpeReference, setLegacyPpeReference] = useState("");
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
    let active = true;

    (async () => {
      setLoadingInitial(true);
      setErro("");
      setNaoEncontrada(false);

      try {
        const currentProfile = await getCurrentProfile();
        setProfile(currentProfile);
        if (!canEditRepresentacoes(currentProfile)) {
          setRestricted(true);
          return;
        }
        setRestricted(false);

        const [data, pessoasResult, tagsResult, tagIdsResult] = await Promise.all([
          getRepresentacaoById(representacaoId),
          listRepresentacaoPessoas(representacaoId)
            .then((pessoas) => ({ pessoas, failed: false }))
            .catch((error: unknown) => {
              console.warn("[representacoes:editar] pessoas adicionais indisponiveis", error);
              return { pessoas: [], failed: true };
            }),
          listProceduralTags([
            "movimentacao_tipo",
            "movimentacao_status",
            "prioridade",
            "movimentacao_geral",
          ]),
          listMovimentacaoTagIds(representacaoId),
        ]);
        if (!active) return;

        if (!data) {
          setNaoEncontrada(true);
          return;
        }

        const tipoAtual = data.tipo ?? "";
        const tipoNormalizado = normalizeRepresentationType(data.tipo_normalizado ?? tipoAtual);

        const hasInquiryReference = Boolean(
          data.inquerito_id || String(data.numero_ppe ?? "").trim(),
        );
        const hasNoInquiryJustification = Boolean(
          String(data.justificativa_sem_inquerito ?? "").trim(),
        );
        setPpe(data.numero_ppe ?? "");
        setLegacyPpeReference(
          !data.inquerito_id && String(data.numero_ppe ?? "").trim()
            ? String(data.numero_ppe).trim()
            : "",
        );
        setVinculoInquerito(hasInquiryReference ? "sim" : hasNoInquiryJustification ? "nao" : "");
        setInqueritoId(data.inquerito_id ?? null);
        setJustificativaSemInquerito(data.justificativa_sem_inquerito ?? "");
        setProcesso(data.processo_judicial ?? "");
        setTagOptions(tagsResult);
        setSelectedTagIds(tagIdsResult);
        setStatusTagId(
          data.status_tag_id ??
            tagsResult.find(
              (tag) =>
                tag.scope === "movimentacao_status" &&
                normalizeText(tag.name) === normalizeText(data.status),
            )?.id ??
            "",
        );
        setTipoRepresentacao(
          tipoNormalizado === "outros" && tipoAtual && normalizeText(tipoAtual) !== "outra"
            ? "Outra"
            : representationTypeLabel(tipoNormalizado),
        );
        setTipoOutra(tipoNormalizado === "outros" ? tipoAtual : "");
        setDataRepresentacao(data.data_protocolo ?? data.data_representacao ?? "");
        setResponsavel(data.responsavel ?? "");
        setVitima(data.vitima ?? "");
        setInvestigado(data.investigado ?? "");
        setAutorPreso(data.autor_preso ?? "");
        setPessoasCarregadas(!pessoasResult.failed);
        setPessoasAdicionais(
          pessoasResult.pessoas.map((person) => ({
            id: person.id,
            papel: person.papel,
            nome: person.nome,
            observacao: person.observacao ?? "",
          })),
        );
        setResumoFatos(data.resumo_fatos ?? "");
        setFundamentacao(data.fundamentacao ?? "");
        setObjetivo(data.objetivo ?? "");
        setDiligenciasRelacionadas(data.diligencias_relacionadas ?? "");
        setStatus(data.status ?? "");
        setDataEnvioJudiciario(data.data_envio_judiciario ?? "");
        setDataDecisaoJudicial(data.data_decisao_judicial ?? "");
        setObservacoesDecisao(data.observacoes_decisao ?? "");
        setVaraJuizo(data.vara_juizo ?? "");
        setPrazoConcedidoDias(
          data.prazo_concedido_dias != null ? String(data.prazo_concedido_dias) : "",
        );
        setDataVencimento(data.data_vencimento ?? "");
        setDataCumprimento(data.data_cumprimento ?? "");
        const savedComplianceStatus = String(data.cumprimento_status ?? "");
        setCumprimentoStatus(
          COMPLIANCE_STATUS_OPTIONS.some((option) => option.value === savedComplianceStatus)
            ? (savedComplianceStatus as ComplianceStatus)
            : normalizeText(data.status).includes("parcial")
              ? "parcial"
              : normalizeText(data.status).includes("cumprid")
                ? "cumprido"
                : normalizeText(data.status).includes("indefer")
                  ? "indeferido"
                  : "pendente",
        );
        setEquipeCumprimento(data.equipe_cumprimento ?? "");
        setResultadoCumprimento(data.resultado_cumprimento ?? "");
        setObservacoesCumprimento(data.observacoes_cumprimento ?? "");
        setPrioridadeOperacional(data.prioridade_operacional ?? "");
        setPedidoSigiloso(data.pedido_sigiloso ?? "");
        setObservacoesInternas(data.observacoes_movimentacao ?? data.observacoes_internas ?? "");
        setEquipeResponsavel(data.equipe_responsavel ?? "");
        setAcompanhamentoEspecial(
          data.acompanhamento_especial == null ? "" : data.acompanhamento_especial ? "Sim" : "Não",
        );
      } catch (error) {
        if (!active) return;
        const err = error as { code?: string };
        if (err?.code === "42501" || err?.code === "PGRST301") {
          setErro(
            "Sem permissão para consultar esta representação. Verifique as policies de SELECT da tabela public.representacoes.",
          );
        } else {
          setErro("Não foi possível carregar a representação agora.");
        }
      } finally {
        if (active) setLoadingInitial(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [representacaoId]);

  useEffect(() => {
    const normalizedPpe = ppe.trim();
    if (loadingInitial || vinculoInquerito !== "sim" || inqueritoId || normalizedPpe.length < 2) {
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
  }, [inqueritoId, loadingInitial, ppe, vinculoInquerito]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loadingSubmit || naoEncontrada || !canEditRepresentacoes(profile)) return;

    setErro("");

    const selectedTypes = typeTagOptions.filter((tag) => selectedTagIds.includes(tag.id));
    const selectedPriorities = priorityTagOptions.filter((tag) => selectedTagIds.includes(tag.id));
    if (!statusTagId || selectedTypes.length === 0) {
      setErro("Selecione ao menos um tipo de protocolo e o status da movimentação.");
      return;
    }
    const tipoFinal = selectedTypes.map((tag) => tag.name).join("; ");
    if (!vinculoInquerito) {
      setErro("Informe se a movimentação possui procedimento vinculado.");
      return;
    }
    const preservesLegacyPpe =
      !inqueritoId && Boolean(legacyPpeReference) && ppe.trim() === legacyPpeReference;
    if (vinculoInquerito === "sim" && !inqueritoId && !preservesLegacyPpe) {
      setErro("Selecione o inquérito vinculado antes de salvar.");
      return;
    }
    if (vinculoInquerito === "nao" && !justificativaSemInquerito.trim()) {
      setErro(
        "Selecione o inquérito vinculado ou informe por que a representação ainda não possui vínculo formal.",
      );
      return;
    }

    setLoadingSubmit(true);

    try {
      await updateRepresentacao(representacaoId, {
        inquerito_id: vinculoInquerito === "sim" ? inqueritoId : null,
        justificativa_sem_inquerito:
          vinculoInquerito === "nao" ? justificativaSemInquerito.trim() : null,
        numero_ppe: ppe.trim() || null,
        processo_judicial: processo.trim() || null,
        tipo: tipoFinal.trim() || null,
        tipo_normalizado: normalizeRepresentationType(tipoFinal),
        data_representacao: dataRepresentacao || null,
        data_protocolo: dataRepresentacao || null,
        status_tag_id: statusTagId,
        status: statusTagOptions.find((tag) => tag.id === statusTagId)?.name || status || null,
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
        pedido_sigiloso: pedidoSigiloso || null,
        pedido_sigiloso_normalizado: pedidoSigiloso ? isYesValue(pedidoSigiloso) : null,
        medida_protetiva_normalizada: normalizeRepresentationType(tipoFinal) === "medida_protetiva",
        observacoes_movimentacao: observacoesInternas.trim() || null,
      });
      await replaceMovimentacaoTags(representacaoId, selectedTagIds);
      await navigate({ to: "/representacoes/$representacaoId", params: { representacaoId } });
    } catch (error) {
      const err = error as {
        code?: string;
        message?: string;
        details?: string;
        hint?: string;
        status?: number;
      };
      if (err?.code === "42501" || err?.code === "PGRST301") {
        setErro(
          "Sem permissão para atualizar esta representação. Verifique as policies de UPDATE da tabela public.representacoes.",
        );
      } else if (err?.code === "REPRESENTACAO_UPDATE_EMPTY") {
        setErro(
          "Não foi possível salvar porque o registro não foi retornado após a atualização. Verifique permissões de UPDATE/SELECT desta representação.",
        );
      } else {
        setErro("Não foi possível salvar as alterações agora.");
      }

      if (import.meta.env.DEV) {
        console.debug("[representacoes:editar] submit error", {
          id: representacaoId,
          error: {
            message: err?.message,
            code: err?.code,
            details: err?.details,
            hint: err?.hint,
            status: err?.status,
          },
        });
      }
    } finally {
      setLoadingSubmit(false);
    }
  }

  if (loadingInitial) return <AppLayout>Carregando movimentação...</AppLayout>;
  if (restricted)
    return (
      <AppLayout>
        <div className="space-y-4">
          <h1 className="text-xl font-bold">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground">
            Seu perfil não possui permissão para acessar Movimentações Processuais.
          </p>
          <Link to="/modulos" className="px-4 py-2 border border-border rounded-lg inline-block">
            Voltar
          </Link>
        </div>
      </AppLayout>
    );
  if (naoEncontrada) return <AppLayout>Movimentação não encontrada.</AppLayout>;

  return (
    <AppLayout>
      <PageHeader
        title="Editar Movimentação Processual"
        subtitle="Atualize o protocolo e a tramitação judicial"
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

        {showLegacyFields && (
          <>
            <SectionCard
              title="Pessoas Envolvidas"
              subtitle="Partes relacionadas à medida representada."
            >
              {pessoasCarregadas ? (
                <RepresentationPeopleEditor
                  value={pessoasAdicionais}
                  onChange={setPessoasAdicionais}
                />
              ) : (
                <div className="rounded-lg border border-amber-400/35 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                  Os dados principais foram carregados, mas as pessoas adicionais estao
                  temporariamente indisponiveis. Esta parte nao sera alterada ao salvar.
                </div>
              )}
              <Field label="Vítima" value={vitima} onChange={(e) => setVitima(e.target.value)} />
              <Field
                label="Investigado / Representado"
                value={investigado}
                onChange={(e) => setInvestigado(e.target.value)}
              />
              <Select
                label="Autor preso?"
                options={["Sim", "Não", "Não informado"]}
                value={autorPreso}
                onChange={setAutorPreso}
              />
            </SectionCard>
          </>
        )}

        {showLegacyFields && (
          <SectionCard
            title="Fundamentação e Finalidade"
            subtitle="Contexto técnico-jurídico e finalidade da medida."
          >
            <TextArea
              label="Resumo dos fatos"
              value={resumoFatos}
              onChange={(e) => setResumoFatos(e.target.value)}
            />
            <TextArea
              label="Fundamentação da medida"
              value={fundamentacao}
              onChange={(e) => setFundamentacao(e.target.value)}
            />
            <TextArea
              label="Objetivo da representação"
              value={objetivo}
              onChange={(e) => setObjetivo(e.target.value)}
            />
            <TextArea
              label="Diligências relacionadas"
              value={diligenciasRelacionadas}
              onChange={(e) => setDiligenciasRelacionadas(e.target.value)}
            />
          </SectionCard>
        )}

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
          {exibeDataEnvioEVara && (
            <Field
              label="Vara / Juízo"
              value={varaJuizo}
              onChange={(e) => setVaraJuizo(e.target.value)}
            />
          )}
          {exibeDecisaoEPrazo && (
            <Field
              label="Data da decisão judicial"
              type="date"
              value={dataDecisaoJudicial}
              onChange={(e) => setDataDecisaoJudicial(e.target.value)}
            />
          )}
          {exibeDecisaoEPrazo && (
            <Field
              label="Prazo concedido (dias)"
              type="number"
              min={0}
              value={prazoConcedidoDias}
              onChange={(e) => setPrazoConcedidoDias(e.target.value)}
            />
          )}
          {exibeDecisaoEPrazo && (
            <Field
              label="Data de vencimento"
              type="date"
              value={dataVencimento}
              onChange={(e) => setDataVencimento(e.target.value)}
            />
          )}
          {exibeDecisaoEObservacoes && (
            <Field
              label="Data da decisão judicial"
              type="date"
              value={dataDecisaoJudicial}
              onChange={(e) => setDataDecisaoJudicial(e.target.value)}
            />
          )}
          {exibeDecisaoEObservacoes && (
            <TextArea
              label="Observações da decisão"
              value={observacoesDecisao}
              onChange={(e) => setObservacoesDecisao(e.target.value)}
            />
          )}

          {showLegacyFields && exibeBlocoCumprimento && (
            <SectionCard
              title="Cumprimento da Medida"
              subtitle="Registro operacional da execução da decisão."
            >
              <Field
                label="Data do cumprimento"
                type="date"
                value={dataCumprimento}
                onChange={(e) => setDataCumprimento(e.target.value)}
              />
              <Field
                label="Equipe responsável pelo cumprimento"
                value={equipeCumprimento}
                onChange={(e) => setEquipeCumprimento(e.target.value)}
              />
              <OptionSelect
                label="Resultado do cumprimento"
                options={COMPLIANCE_RESULT_OPTIONS}
                value={resultadoCumprimento}
                onChange={setResultadoCumprimento}
                hint={
                  resultadoCumprimento
                    ? COMPLIANCE_RESULT_DESCRIPTIONS[resultadoCumprimento as ComplianceResult]
                    : "Classifique o efeito efetivo da medida após a execução."
                }
              />
              <TextArea
                label="Observações do cumprimento"
                value={observacoesCumprimento}
                onChange={(e) => setObservacoesCumprimento(e.target.value)}
              />
            </SectionCard>
          )}

          <ProceduralTagPicker
            label="Prioridade"
            options={priorityTagOptions}
            value={selectedTagIds}
            onChange={setSelectedTagIds}
            createScope="prioridade"
            canCreate={false}
          />
          <Select
            label="Pedido sigiloso?"
            options={canAccessSigilosa(profile) ? ["Sim", "Não"] : ["Não"]}
            value={pedidoSigiloso}
            onChange={setPedidoSigiloso}
          />
          <TextArea
            label="Observações"
            value={observacoesInternas}
            onChange={(e) => setObservacoesInternas(e.target.value)}
          />
        </SectionCard>

        {erro && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {erro}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Link
            to="/representacoes/$representacaoId"
            params={{ representacaoId }}
            className="px-5 py-2.5 rounded-lg text-sm border border-border hover:bg-accent"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loadingSubmit}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 shadow-lg shadow-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingSubmit ? "Salvando..." : "Salvar alterações"}
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
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border/60 bg-background/70 p-5 lg:p-7">
      <h2 className="text-sm font-bold tracking-[0.2em] text-primary uppercase">{title}</h2>
      {subtitle && <p className="mt-1 mb-5 text-xs text-muted-foreground">{subtitle}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
    </section>
  );
}
function Field({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
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
}: { label: string; rows?: number } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
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
        value={value ?? ""}
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
function InfoBox({ children }: { children: ReactNode }) {
  return (
    <div className="md:col-span-2 lg:col-span-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
      {children}
    </div>
  );
}
