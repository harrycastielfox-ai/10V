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
import { classifyAuthorship } from "@/lib/authorship";
import { FormFieldLabel } from "@/components/FormFieldLabel";
import { InquiryPeopleEditor } from "@/components/InquiryPeopleEditor";
import { ProceduralStatusSelect, ProceduralTagPicker } from "@/components/ProceduralTagPicker";
import { SeizedWeaponsField } from "@/components/SeizedWeaponsField";
import {
  getInqueritoById,
  listInqueritoPessoas,
  listKnownInqueritoBairros,
  replaceInqueritoPessoas,
  updateInquerito,
} from "@/lib/repositories/inqueritosRepository";
import {
  createProceduralTag,
  listInqueritoTagIds,
  listProceduralTags,
  replaceInqueritoTags,
} from "@/lib/repositories/proceduralTagsRepository";
import { tagsByScope, type ProceduralTag } from "@/lib/proceduralTags";
import { getCurrentProfile } from "@/lib/auth";
import {
  canEditCases,
  canManageProceduralTags,
  canOnlyViewPublicCases,
  canViewPrivateCases,
  type UserProfile,
} from "@/lib/authz";
import { CASE_CATEGORY_OPTIONS, normalizeCaseCategory } from "@/lib/inqueritosPriority";
import {
  OCCURRENCE_ORIGIN_OPTIONS,
  PROCEDURE_TYPE_OPTIONS,
  REPORT_STATUS_OPTIONS,
  createInquiryPerson,
  isYesValue,
  normalizeCriminalCategory,
  normalizePriority,
  normalizeProcedureType,
  procedureTypeLabel,
  type OccurrenceOrigin,
  type InquiryPersonFormValue,
  type ReportStatus,
  type SelectOption,
} from "@/lib/operationalContracts";

export const Route = createFileRoute("/inqueritos/$caseId/editar")({ component: EditarInquerito });

function toInputDate(value: string | null | undefined) {
  if (!value) return "";
  const normalized = value.trim();
  if (!normalized) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "";
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return `${fallback} (${error.message})`;
  }
  return fallback;
}

function EditarInquerito() {
  const { caseId } = Route.useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [pessoasCarregadas, setPessoasCarregadas] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [restricted, setRestricted] = useState(false);

  const [numeroPpe, setNumeroPpe] = useState("");
  const [numeroFisico, setNumeroFisico] = useState("");
  const [numeroBo, setNumeroBo] = useState("");
  const [tipificacao, setTipificacao] = useState("");
  const [tagOptions, setTagOptions] = useState<ProceduralTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [statusTagId, setStatusTagId] = useState("");
  const [resumoFato, setResumoFato] = useState("");
  const [gravidade, setGravidade] = useState("");
  const [tipo, setTipo] = useState("");
  const [origemRegistro, setOrigemRegistro] = useState<OccurrenceOrigin>("novo");
  const [prioridade, setPrioridade] = useState("");
  const [situacao, setSituacao] = useState("");
  const [statusDiligencias, setStatusDiligencias] = useState("");
  const [dataElucidacao, setDataElucidacao] = useState("");
  const [dataFato, setDataFato] = useState("");
  const [dataInstauracao, setDataInstauracao] = useState("");
  const [prazo, setPrazo] = useState("");
  const [prazoDias, setPrazoDias] = useState("");
  const [prazoManual, setPrazoManual] = useState(false);
  const [pessoas, setPessoas] = useState<InquiryPersonFormValue[]>([]);
  const [reuPreso, setReuPreso] = useState("");
  const [houveArmaFogo, setHouveArmaFogo] = useState("");
  const [armaUtilizada, setArmaUtilizada] = useState("");
  const [bairro, setBairro] = useState("");
  const [bairroOptions, setBairroOptions] = useState<string[]>([]);
  const [distrito, setDistrito] = useState("");
  const [cidade, setCidade] = useState("");
  const [motivacao, setMotivacao] = useState("");
  const [vinculadoFaccao, setVinculadoFaccao] = useState("");
  const [nomeFaccao, setNomeFaccao] = useState("");
  const [delegadoResponsavel, setDelegadoResponsavel] = useState("");
  const [equipe, setEquipe] = useState("");
  const [escrivao, setEscrivao] = useState("");
  const [diligenciasPendentes, setDiligenciasPendentes] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [relatorioStatus, setRelatorioStatus] = useState<ReportStatus>("pendente");
  const [dataRelatorio, setDataRelatorio] = useState("");
  const [dataEnvioRelatorio, setDataEnvioRelatorio] = useState("");
  const [medidaProtetiva, setMedidaProtetiva] = useState("");
  const [numeroProcessoMedida, setNumeroProcessoMedida] = useState("");
  const [representacoesLegais, setRepresentacoesLegais] = useState("");
  const [visibilidade, setVisibilidade] = useState("");
  const [autoria, setAutoria] = useState("");

  const vitima = pessoas.find((pessoa) => pessoa.papel === "vitima")?.nome ?? "";
  const investigado = pessoas.find((pessoa) => pessoa.papel === "autor_investigado")?.nome ?? "";
  const statusOptions = useMemo(() => tagsByScope(tagOptions, "inquerito_status"), [tagOptions]);
  const tipificacaoOptions = useMemo(() => tagsByScope(tagOptions, "tipificacao"), [tagOptions]);

  useEffect(() => {
    if (prazoManual || !dataInstauracao || !prazoDias) return;
    const days = Number(prazoDias);
    if (!Number.isInteger(days) || days < 0) return;
    const dueDate = new Date(`${dataInstauracao}T12:00:00`);
    dueDate.setDate(dueDate.getDate() + days);
    setPrazo(dueDate.toISOString().slice(0, 10));
  }, [dataInstauracao, prazoDias, prazoManual]);

  useEffect(() => {
    let ativo = true;
    const carregar = async () => {
      setLoading(true);
      setErro("");
      setNotFound(false);
      try {
        const [currentProfile, inquerito, pessoasResult, tagsResult, tagIdsResult] =
          await Promise.all([
            getCurrentProfile(),
            getInqueritoById(caseId),
            listInqueritoPessoas(caseId)
              .then((pessoasSalvas) => ({ pessoasSalvas, failed: false }))
              .catch((peopleError: unknown) => {
                console.warn("[inqueritos:editar] pessoas adicionais indisponiveis", peopleError);
                return { pessoasSalvas: [], failed: true };
              }),
            listProceduralTags(["inquerito_status", "tipificacao", "inquerito_geral"])
              .then((tags) => ({ tags, failed: false }))
              .catch((tagsError: unknown) => {
                console.warn("[inqueritos:editar] catálogo de tags indisponível", tagsError);
                return { tags: [], failed: true };
              }),
            listInqueritoTagIds(caseId)
              .then((tagIds) => ({ tagIds, failed: false }))
              .catch((tagsError: unknown) => {
                console.warn("[inqueritos:editar] vínculos de tags indisponíveis", tagsError);
                return { tagIds: [], failed: true };
              }),
          ]);
        setProfile(currentProfile);
        if (!canEditCases(currentProfile)) {
          setRestricted(true);
          return;
        }
        if (!ativo) return;
        if (!inquerito) {
          setNotFound(true);
          return;
        }
        const raw = inquerito as unknown as Record<string, unknown>;
        const visibility = String(
          raw.visibilidade ?? raw.visibility ?? raw.publico_privado ?? "",
        ).toLowerCase();
        const isPrivate = visibility.includes("priv") || visibility.includes("sig");
        if (isPrivate && canOnlyViewPublicCases(currentProfile)) {
          setRestricted(true);
          return;
        }

        setNumeroPpe(inquerito.numero_ppe ?? "");
        setNumeroFisico(inquerito.numero_fisico ?? "");
        setNumeroBo(inquerito.numero_bo ?? "");
        setTipificacao(inquerito.tipificacao ?? "");
        setTagOptions(tagsResult.tags);
        setSelectedTagIds(tagIdsResult.tagIds);
        setStatusTagId(
          inquerito.status_tag_id ??
            tagsResult.tags.find(
              (tag) =>
                tag.scope === "inquerito_status" &&
                tag.name.toLocaleLowerCase("pt-BR") ===
                  (inquerito.situacao ?? "").toLocaleLowerCase("pt-BR"),
            )?.id ??
            "",
        );
        setResumoFato(inquerito.resumo_fato ?? "");
        setGravidade(normalizeCaseCategory(inquerito.gravidade, "Outros"));
        setTipo(
          procedureTypeLabel(
            normalizeProcedureType(inquerito.tipo_procedimento_normalizado ?? inquerito.tipo),
          ),
        );
        const savedOrigin = String(inquerito.origem_registro ?? "");
        setOrigemRegistro(
          OCCURRENCE_ORIGIN_OPTIONS.some((option) => option.value === savedOrigin)
            ? (savedOrigin as OccurrenceOrigin)
            : "novo",
        );
        setPrioridade(inquerito.prioridade ?? "");
        setSituacao(inquerito.situacao ?? "");
        setStatusDiligencias(inquerito.status_diligencias ?? "");
        setDataElucidacao(toInputDate(inquerito.data_elucidacao));
        setDataFato(toInputDate(inquerito.data_fato));
        setDataInstauracao(toInputDate(inquerito.data_instauracao));
        setPrazo(toInputDate(inquerito.prazo_data_final ?? inquerito.prazo));
        setPrazoDias(inquerito.prazo_dias?.toString() ?? "");
        setPrazoManual(Boolean(inquerito.prazo_manual || !inquerito.prazo_dias));
        setPessoasCarregadas(!pessoasResult.failed);
        const pessoasIniciais = pessoasResult.pessoasSalvas.map((pessoa) => ({
          id: pessoa.id,
          papel: pessoa.papel,
          nome: pessoa.nome,
          observacao: pessoa.observacao ?? "",
        }));
        if (pessoasIniciais.length === 0) {
          const vitimaLegada = (inquerito.vitima ?? "").trim();
          const investigadoLegado = (inquerito.investigado ?? "").trim();
          if (vitimaLegada)
            pessoasIniciais.push({ ...createInquiryPerson("vitima"), nome: vitimaLegada });
          if (investigadoLegado)
            pessoasIniciais.push({
              ...createInquiryPerson("autor_investigado"),
              nome: investigadoLegado,
            });
        }
        setPessoas(pessoasIniciais);
        setAutoria(
          classifyAuthorship(raw.autoria_determinada) === "desconhecida"
            ? "Desconhecida"
            : String(raw.autoria_determinada ?? ""),
        );
        setReuPreso(inquerito.reu_preso ?? "");
        setHouveArmaFogo(inquerito.houve_arma_fogo ?? "");
        setArmaUtilizada(inquerito.arma_utilizada ?? "");
        setBairro(inquerito.bairro ?? "");
        setDistrito(inquerito.distrito ?? "");
        setCidade(inquerito.cidade ?? inquerito.distrito ?? "Itabela");
        setMotivacao(inquerito.motivacao ?? "");
        setVinculadoFaccao(inquerito.faccao ?? "");
        setNomeFaccao(inquerito.nome_faccao ?? "");
        setDelegadoResponsavel(inquerito.delegado_responsavel ?? "");
        setEquipe(inquerito.equipe ?? "");
        setEscrivao(inquerito.escrivao ?? "");
        setDiligenciasPendentes(
          [inquerito.diligencias_pendentes, inquerito.observacoes]
            .map((value) => value?.trim())
            .filter(
              (value, index, values): value is string =>
                Boolean(value) && values.indexOf(value) === index,
            )
            .join("\n\n"),
        );
        setObservacoes(inquerito.observacoes ?? "");
        const savedReportStatus = String(inquerito.relatorio_status ?? "");
        setRelatorioStatus(
          REPORT_STATUS_OPTIONS.some((option) => option.value === savedReportStatus)
            ? (savedReportStatus as ReportStatus)
            : isYesValue(inquerito.relatorio_enviado)
              ? "enviado"
              : inquerito.data_relatorio
                ? "relatado"
                : "pendente",
        );
        setDataRelatorio(toInputDate(inquerito.data_relatorio));
        setDataEnvioRelatorio(toInputDate(inquerito.data_envio_relatorio));
        setMedidaProtetiva(inquerito.medida_protetiva ?? "");
        setNumeroProcessoMedida(inquerito.numero_processo_medida ?? "");
        setRepresentacoesLegais(inquerito.representacoes_legais ?? "");
        const savedVisibilidade = (inquerito.visibilidade ?? "").trim();
        setVisibilidade(savedVisibilidade);
        if (import.meta.env.DEV) {
          console.debug("[Inqueritos][Editar] visibilidade carregada", {
            inqueritoId: caseId,
            visibilidade: savedVisibilidade || null,
          });
        }
      } catch (error) {
        if (!ativo) return;
        setErro(getErrorMessage(error, "Erro ao carregar"));
      } finally {
        if (ativo) setLoading(false);
      }
    };
    carregar();
    return () => {
      ativo = false;
    };
  }, [caseId]);

  useEffect(() => {
    let active = true;
    void listKnownInqueritoBairros()
      .then((bairros) => {
        if (active) setBairroOptions(bairros);
      })
      .catch((error) => console.warn("[inqueritos:editar:bairros]", error));
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || !canEditCases(profile)) return;
    setErro("");
    setFeedback("");
    if (!statusTagId) {
      setErro("Selecione o status do procedimento.");
      return;
    }
    const selectedTipificacoes = tipificacaoOptions.filter((tag) =>
      selectedTagIds.includes(tag.id),
    );
    if (selectedTipificacoes.length === 0) {
      setErro("Adicione ao menos uma tipificação.");
      return;
    }
    setSaving(true);

    try {
      const normalizedType = normalizeProcedureType(tipo);
      const normalizedCategory = normalizeCriminalCategory(gravidade);
      const isCvli = normalizedCategory === "CVLI";
      const autoriaDeterminada = autoria === "Determinada";
      const payload = {
        numero_ppe: numeroPpe.trim() || null,
        origem_registro: origemRegistro,
        visibilidade: visibilidade.trim() || null,
        tipificacao: selectedTipificacoes.map((tag) => tag.name).join("; "),
        resumo_fato: resumoFato.trim() || null,
        gravidade: normalizeCaseCategory(gravidade, "Outros"),
        tipo: tipo.trim() || null,
        tipo_procedimento_normalizado: normalizedType,
        prioridade: prioridade.trim() || null,
        prioridade_operacional: normalizePriority(prioridade),
        categoria_criminal: normalizedCategory,
        status_tag_id: statusTagId,
        situacao: statusOptions.find((tag) => tag.id === statusTagId)?.name || situacao || null,
        elucidado: autoria ? (autoriaDeterminada ? "Sim" : "Não") : null,
        cvli_elucidado: isCvli && autoria ? autoriaDeterminada : null,
        data_elucidacao: isCvli && autoriaDeterminada ? dataElucidacao || null : null,
        data_fato: dataFato || null,
        data_instauracao: dataInstauracao || null,
        prazo: prazo || null,
        prazo_dias: prazoDias.trim() ? Number(prazoDias) : null,
        prazo_data_final: prazo || null,
        prazo_manual: prazoManual,
        vitima: vitima.trim() || null,
        investigado: investigado.trim() || null,
        autoria_determinada: autoria.trim() || null,
        reu_preso: reuPreso.trim() || null,
        reu_preso_normalizado: reuPreso ? isYesValue(reuPreso) : null,
        houve_arma_fogo: houveArmaFogo.trim() || null,
        arma_utilizada: armaUtilizada.trim() || null,
        bairro: bairro.trim() || null,
        distrito: cidade.trim() || null,
        cidade: cidade.trim() || null,
        motivacao: motivacao.trim() || null,
        faccao: vinculadoFaccao.trim() || null,
        nome_faccao: nomeFaccao.trim() || null,
        diligencias_pendentes: diligenciasPendentes.trim() || null,
        observacoes: null,
      };

      await updateInquerito(caseId, payload);
      let tagsWarning = false;
      try {
        await replaceInqueritoTags(caseId, selectedTagIds);
      } catch (tagsError) {
        tagsWarning = true;
        console.warn(
          "[inqueritos:tags] Dados principais atualizados sem vínculos de tags",
          tagsError,
        );
      }
      let pessoasWarning = false;
      if (pessoasCarregadas) {
        try {
          await replaceInqueritoPessoas(
            caseId,
            pessoas
              .filter((pessoa) => pessoa.nome.trim())
              .map((pessoa, ordem) => ({
                papel: pessoa.papel,
                nome: pessoa.nome.trim(),
                observacao: pessoa.observacao.trim() || null,
                ordem,
              })),
          );
        } catch (pessoasError) {
          pessoasWarning = true;
          console.warn(
            "[inqueritos:pessoas] Dados principais atualizados sem pessoas",
            pessoasError,
          );
        }
      }
      setFeedback(
        pessoasWarning || tagsWarning
          ? "Procedimento atualizado, mas alguns vínculos complementares precisam ser conferidos."
          : "Procedimento atualizado com sucesso.",
      );
      setTimeout(() => {
        navigate({ to: "/inqueritos/$caseId", params: { caseId } });
      }, 300);
    } catch (error) {
      setErro(getErrorMessage(error, "Erro ao salvar"));
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <AppLayout>
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          Carregando dados do procedimento...
        </div>
      </AppLayout>
    );

  if (restricted) {
    return (
      <AppLayout>
        <div className="max-w-3xl space-y-3">
          <Link
            to="/inqueritos"
            className="text-xs border border-border rounded-md px-3 py-1.5 inline-block"
          >
            ← Voltar para procedimentos
          </Link>
          <p className="rounded-lg border border-warning/50 bg-warning/10 px-4 py-3 text-sm text-warning">
            Acesso restrito
          </p>
        </div>
      </AppLayout>
    );
  }

  if (notFound) {
    return (
      <AppLayout>
        <div className="max-w-3xl space-y-3">
          <Link
            to="/inqueritos/$caseId"
            params={{ caseId }}
            className="text-xs border border-border rounded-md px-3 py-1.5 inline-block"
          >
            ← Voltar aos detalhes
          </Link>
          <p className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Procedimento não encontrado
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl space-y-4 pb-6">
        <Link
          to="/inqueritos/$caseId"
          params={{ caseId }}
          className="text-xs border border-border rounded-md px-3 py-1.5 inline-block"
        >
          ← Voltar aos detalhes
        </Link>
        <h1 className="text-2xl font-bold">Editar Procedimento Policial</h1>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <SectionCard title="Identificação do Procedimento">
            <Field
              label="PPE"
              placeholder="Ex.: 001/2026-DPPC"
              value={numeroPpe}
              onChange={(e) => setNumeroPpe(e.target.value)}
            />
            <OptionSelect
              label="Origem do registro"
              options={OCCURRENCE_ORIGIN_OPTIONS}
              value={origemRegistro}
              onChange={(value) => setOrigemRegistro(value as OccurrenceOrigin)}
            />
            <Select
              label="Tipo de Procedimento"
              value={tipo}
              onChange={setTipo}
              options={PROCEDURE_TYPE_OPTIONS.map((option) => option.label)}
            />
            <Select
              label="Visibilidade"
              options={canViewPrivateCases(profile) ? ["Público", "Sigiloso"] : ["Público"]}
              value={visibilidade}
              onChange={setVisibilidade}
            />
            <Field
              label="Data do Fato"
              type="date"
              value={dataFato}
              onChange={(e) => setDataFato(e.target.value)}
            />
            <Field
              label="Data de Instauração"
              type="date"
              value={dataInstauracao}
              onChange={(e) => setDataInstauracao(e.target.value)}
            />
            <Field
              label="Prazo do procedimento (dias)"
              type="number"
              min={0}
              max={3650}
              value={prazoDias}
              onChange={(event) => setPrazoDias(event.target.value)}
            />
            <div>
              <FormFieldLabel label="Data final calculada" />
              <input
                type="date"
                value={prazo}
                disabled={!prazoManual}
                onChange={(event) => setPrazo(event.target.value)}
                className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-70"
              />
              <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={prazoManual}
                  onChange={(event) => setPrazoManual(event.target.checked)}
                />
                Alterar a data final manualmente
              </label>
            </div>
          </SectionCard>

          <SectionCard title="Movimentações Processuais">
            <div className="md:col-span-2 lg:col-span-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/25 bg-primary/[0.05] px-4 py-3">
              <div>
                <p className="text-sm font-bold text-foreground">
                  Registrar protocolo vinculado a este procedimento
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Inclui representações, decisões e relatório final no histórico processual.
                </p>
              </div>
              <a
                href={`/nova-representacao?inqueritoId=${encodeURIComponent(caseId)}&ppe=${encodeURIComponent(numeroPpe)}`}
                className="inline-flex h-9 items-center rounded-md border border-primary/40 bg-primary/10 px-4 text-xs font-bold text-primary transition-colors hover:bg-primary/15"
              >
                Cadastrar movimentação
              </a>
            </div>
          </SectionCard>

          <SectionCard title="Classificação do Caso">
            <ProceduralTagPicker
              label="Tipificações"
              hint="Adicione um ou mais crimes. Cada tipificação poderá ser usada em filtros e relatórios."
              options={tipificacaoOptions}
              value={selectedTagIds}
              onChange={setSelectedTagIds}
              onCreate={async (input) => {
                const created = await createProceduralTag(input);
                setTagOptions((current) => [...current, created]);
                return created;
              }}
              createScope="tipificacao"
              canCreate={canManageProceduralTags(profile)}
            />
            <Select
              label="Categoria do Caso"
              value={gravidade}
              onChange={setGravidade}
              options={[...CASE_CATEGORY_OPTIONS]}
            />
            <ProceduralStatusSelect
              label="Status do procedimento"
              options={statusOptions}
              value={statusTagId}
              onChange={setStatusTagId}
            />
            <TextArea
              label="Resumo do Fato"
              rows={5}
              placeholder="Registre, de forma objetiva, o fato que originou o procedimento..."
              value={resumoFato}
              onChange={(event) => setResumoFato(event.target.value)}
            />
            {normalizeCriminalCategory(gravidade) === "CVLI" && autoria === "Determinada" && (
              <Field
                label="Data da elucidação"
                type="date"
                value={dataElucidacao}
                onChange={(e) => setDataElucidacao(e.target.value)}
              />
            )}
            <SeizedWeaponsField
              checked={isYesValue(houveArmaFogo)}
              onCheckedChange={(checked) => {
                setHouveArmaFogo(checked ? "Sim" : "Não");
                if (!checked) setArmaUtilizada("");
              }}
              value={armaUtilizada}
              onValueChange={setArmaUtilizada}
            />
          </SectionCard>

          <SectionCard title="Pessoas Envolvidas">
            <Select
              label="Autoria"
              value={autoria}
              onChange={setAutoria}
              options={["Determinada", "Desconhecida", "Sem Autoria"]}
            />
            <Select
              label="Réu Preso"
              value={reuPreso}
              onChange={setReuPreso}
              options={["Sim", "Não"]}
            />
            {pessoasCarregadas ? (
              <InquiryPeopleEditor value={pessoas} onChange={setPessoas} />
            ) : (
              <div className="rounded-lg border border-amber-400/35 bg-amber-400/10 px-4 py-3 text-sm text-amber-200 md:col-span-2 lg:col-span-3">
                Os dados principais foram carregados, mas as pessoas adicionais estao
                temporariamente indisponiveis. Esta parte nao sera alterada ao salvar.
              </div>
            )}
          </SectionCard>

          <SectionCard title="Dados Operacionais">
            <Field
              label="Bairro"
              list="editar-inquerito-bairros"
              placeholder="Informe ou selecione um bairro já utilizado"
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
            />
            <datalist id="editar-inquerito-bairros">
              {bairroOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
            <Field label="Cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} />
            <Field
              label="Motivação"
              value={motivacao}
              onChange={(e) => setMotivacao(e.target.value)}
            />
            <Select
              label="Vinculado a Facção"
              value={vinculadoFaccao}
              onChange={setVinculadoFaccao}
              options={["Sim", "Não", "A definir"]}
            />
            <Field
              label="Nome da Facção"
              value={nomeFaccao}
              onChange={(e) => setNomeFaccao(e.target.value)}
            />
            <TextArea
              label="Observações e Diligências"
              rows={6}
              placeholder="Registre observações, diligências realizadas e providências pendentes..."
              value={diligenciasPendentes}
              onChange={(e) => setDiligenciasPendentes(e.target.value)}
            />
          </SectionCard>

          {(erro || feedback || saving) && (
            <div className="space-y-2">
              {erro && (
                <p className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                  {erro}
                </p>
              )}
              {saving && (
                <p className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground">
                  Salvando...
                </p>
              )}
              {feedback && (
                <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400">
                  {feedback}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => navigate({ to: "/inqueritos/$caseId", params: { caseId } })}
              className="px-5 py-2.5 rounded-lg text-sm border border-border hover:bg-accent"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar procedimento"}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border/60 bg-background/70 p-5 lg:p-7">
      <h2 className="text-sm font-bold tracking-[0.2em] text-primary uppercase mb-5">{title}</h2>
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
        {...props}
        rows={rows}
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
  options: string[];
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
          <option key={option} value={option}>
            {option}
          </option>
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
}: {
  label: string;
  options: readonly SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <div>
      <FormFieldLabel label={label} />
      <select
        value={value ?? ""}
        onChange={(event) => onChange?.(event.target.value)}
        className="w-full bg-card border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
      >
        <option value="">Selecione...</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
