import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { FormFieldLabel } from "@/components/FormFieldLabel";
import { PageHeader } from "@/components/PageHeader";
import { InquiryPeopleEditor } from "@/components/InquiryPeopleEditor";
import { ProceduralStatusSelect, ProceduralTagPicker } from "@/components/ProceduralTagPicker";
import {
  createInquerito,
  findInqueritosByPpe,
  replaceInqueritoPessoas,
  type InqueritoLinkOption,
} from "@/lib/repositories/inqueritosRepository";
import {
  createProceduralTag,
  listProceduralTags,
  replaceInqueritoTags,
} from "@/lib/repositories/proceduralTagsRepository";
import { tagsByScope, type ProceduralTag } from "@/lib/proceduralTags";
import { getCurrentProfile } from "@/lib/auth";
import {
  canCreateCases,
  canManageProceduralTags,
  canViewPrivateCases,
  type UserProfile,
} from "@/lib/authz";
import { CASE_CATEGORY_OPTIONS, normalizeCaseCategory } from "@/lib/inqueritosPriority";
import {
  OCCURRENCE_ORIGIN_OPTIONS,
  PROCEDURE_TYPE_OPTIONS,
  REPORT_STATUS_OPTIONS,
  createInquiryPerson,
  getInquiryRegistrationChecks,
  isYesValue,
  normalizeCriminalCategory,
  normalizePriority,
  normalizeProcedureType,
  type OccurrenceOrigin,
  type InquiryPersonFormValue,
  type ReportStatus,
} from "@/lib/operationalContracts";

export const Route = createFileRoute("/novo-caso")({
  head: () => ({ meta: [{ title: "Novo Caso — SIPI" }] }),
  component: NovoCaso,
});

function NovoCaso() {
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [houveArmaDeFogo, setHouveArmaDeFogo] = useState("");
  const [armaUtilizada, setArmaUtilizada] = useState("");
  const [ppe, setPpe] = useState("");
  const [tipificacao, setTipificacao] = useState("");
  const [tagOptions, setTagOptions] = useState<ProceduralTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [statusTagId, setStatusTagId] = useState("");
  const [resumoFato, setResumoFato] = useState("");
  const [pessoas, setPessoas] = useState<InquiryPersonFormValue[]>([
    createInquiryPerson("vitima"),
    createInquiryPerson("autor_investigado"),
  ]);
  const [autoria, setAutoria] = useState("");
  const [numeroBo, setNumeroBo] = useState("");
  const [numeroFisico, setNumeroFisico] = useState("");
  const [prazo, setPrazo] = useState("");
  const [prazoDias, setPrazoDias] = useState("");
  const [prazoManual, setPrazoManual] = useState(false);
  const [dataFato, setDataFato] = useState("");
  const [dataInstauracao, setDataInstauracao] = useState("");
  const [tipo, setTipo] = useState("Inquérito Policial (IP)");
  const [origemRegistro, setOrigemRegistro] = useState<OccurrenceOrigin>("novo");
  const [ppeMatches, setPpeMatches] = useState<InqueritoLinkOption[]>([]);
  const [checkingPpe, setCheckingPpe] = useState(false);
  const [prioridade] = useState("MÉDIA");
  const [gravidade, setGravidade] = useState("Outro");
  const [situacao, setSituacao] = useState("Instaurado");
  const [statusDiligencias, setStatusDiligencias] = useState("Pendente");
  const [elucidado, setElucidado] = useState("");
  const [reuPreso, setReuPreso] = useState("");
  const [delegadoResponsavel, setDelegadoResponsavel] = useState("");
  const [equipe, setEquipe] = useState("");
  const [escrivao, setEscrivao] = useState("");
  const [bairro, setBairro] = useState("");
  const [distrito, setDistrito] = useState("");
  const [cidade, setCidade] = useState("Itabela");
  const [motivacao, setMotivacao] = useState("");
  const [vinculadoFaccao, setVinculadoFaccao] = useState("");
  const [nomeFaccao, setNomeFaccao] = useState("");
  const [diligenciasPendentes, setDiligenciasPendentes] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [medidaProtetiva, setMedidaProtetiva] = useState("");
  const [numeroProcessoMedida, setNumeroProcessoMedida] = useState("");
  const [relatorioStatus, setRelatorioStatus] = useState<ReportStatus>("pendente");
  const [dataRelatorio, setDataRelatorio] = useState("");
  const [dataEnvioRelatorio, setDataEnvioRelatorio] = useState("");
  const [dataElucidacao, setDataElucidacao] = useState("");
  const [representacoesLegais, setRepresentacoesLegais] = useState("");
  const [visibilidade, setVisibilidade] = useState("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);

  const vitima = pessoas.find((pessoa) => pessoa.papel === "vitima")?.nome ?? "";
  const investigado = pessoas.find((pessoa) => pessoa.papel === "autor_investigado")?.nome ?? "";
  const statusOptions = useMemo(() => tagsByScope(tagOptions, "inquerito_status"), [tagOptions]);
  const tipificacaoOptions = useMemo(() => tagsByScope(tagOptions, "tipificacao"), [tagOptions]);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const currentProfile = await getCurrentProfile();
        if (isMounted) {
          setProfile(currentProfile);
        }
      } catch (error) {
        console.error("Falha ao verificar permissões para /novo-caso", error);
      } finally {
        if (isMounted) {
          setCheckingAccess(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void listProceduralTags(["inquerito_status", "tipificacao", "inquerito_geral"])
      .then((tags) => {
        if (!active) return;
        setTagOptions(tags);
        setStatusTagId(
          (current) =>
            current ||
            tags.find((tag) => tag.scope === "inquerito_status" && tag.slug === "instaurado")?.id ||
            "",
        );
      })
      .catch((error) => {
        console.error("[novo-caso:tags]", error);
        if (active) setErro("Não foi possível carregar o catálogo de status e tags.");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (prazoManual || !dataInstauracao || !prazoDias) return;
    const days = Number(prazoDias);
    if (!Number.isInteger(days) || days < 0) return;
    const dueDate = new Date(`${dataInstauracao}T12:00:00`);
    dueDate.setDate(dueDate.getDate() + days);
    setPrazo(dueDate.toISOString().slice(0, 10));
  }, [dataInstauracao, prazoDias, prazoManual]);

  useEffect(() => {
    const normalizedPpe = ppe.trim();
    if (normalizedPpe.length < 2) {
      setPpeMatches([]);
      setCheckingPpe(false);
      return;
    }

    let isCurrent = true;
    const timer = window.setTimeout(() => {
      setCheckingPpe(true);
      void findInqueritosByPpe(normalizedPpe)
        .then((matches) => {
          if (isCurrent) setPpeMatches(matches);
        })
        .catch(() => {
          if (isCurrent) setPpeMatches([]);
        })
        .finally(() => {
          if (isCurrent) setCheckingPpe(false);
        });
    }, 350);

    return () => {
      isCurrent = false;
      window.clearTimeout(timer);
    };
  }, [ppe]);

  const registrationChecks = useMemo(
    () =>
      getInquiryRegistrationChecks({
        ppe,
        numeroBo,
        origemRegistro,
        visibilidade,
        tipoProcedimento: tipo,
        situacao,
        dataFato,
        dataInstauracao,
        prazo,
        tipificacao,
        resumoFato,
        gravidade,
        vitima,
        investigado,
        autoria,
        reuPreso,
        bairro,
        distrito,
        cidade,
        delegado: delegadoResponsavel,
        equipe,
        escrivao,
        statusDiligencias,
        elucidado,
        dataElucidacao,
        houveArmaDeFogo,
        armaUtilizada,
        vinculadoFaccao,
        nomeFaccao,
        medidaProtetiva,
        numeroProcessoMedida,
        relatorioStatus,
        dataRelatorio,
        dataEnvioRelatorio,
      }),
    [
      armaUtilizada,
      autoria,
      bairro,
      dataElucidacao,
      dataEnvioRelatorio,
      dataFato,
      dataInstauracao,
      dataRelatorio,
      delegadoResponsavel,
      distrito,
      elucidado,
      equipe,
      escrivao,
      gravidade,
      houveArmaDeFogo,
      investigado,
      medidaProtetiva,
      nomeFaccao,
      numeroBo,
      numeroProcessoMedida,
      origemRegistro,
      ppe,
      prazo,
      reuPreso,
      relatorioStatus,
      resumoFato,
      situacao,
      statusDiligencias,
      tipificacao,
      tipo,
      cidade,
      vinculadoFaccao,
      visibilidade,
      vitima,
    ],
  );

  const blockingChecks = registrationChecks.filter((item) => item.blocking && !item.complete);

  const handleHouveArmaDeFogoChange = (value: string) => {
    setHouveArmaDeFogo(value);
    if (value !== "Sim") {
      setArmaUtilizada("");
    }
  };

  const handleElucidadoChange = (value: string) => {
    setElucidado(value);
    if (!isYesValue(value)) setDataElucidacao("");
  };

  const handleVinculoFaccaoChange = (value: string) => {
    setVinculadoFaccao(value);
    if (!isYesValue(value)) setNomeFaccao("");
  };

  const handleMedidaProtetivaChange = (value: string) => {
    setMedidaProtetiva(value);
    if (!isYesValue(value)) setNumeroProcessoMedida("");
  };

  const handleRelatorioStatusChange = (value: ReportStatus) => {
    setRelatorioStatus(value);
    if (value === "pendente") {
      setDataRelatorio("");
      setDataEnvioRelatorio("");
    } else if (value === "relatado") {
      setDataEnvioRelatorio("");
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading || !canCreateCases(profile)) return;
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
    if (blockingChecks.length > 0) {
      setErro(`Revise antes de salvar: ${blockingChecks.map((item) => item.label).join("; ")}.`);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setLoading(true);
    const normalizedType = normalizeProcedureType(tipo);
    const normalizedCategory = normalizeCriminalCategory(normalizeCaseCategory(gravidade, "Outro"));
    const isCvli = normalizedCategory === "CVLI";
    const payload = {
      numero_ppe: ppe.trim() || null,
      numero_bo: null,
      numero_fisico: null,
      origem_registro: origemRegistro,
      visibilidade: visibilidade.trim() || null,
      tipificacao: selectedTipificacoes.map((tag) => tag.name).join("; "),
      resumo_fato: resumoFato.trim() || null,
      vitima: vitima.trim() || null,
      investigado: investigado.trim() || null,
      autoria_determinada: autoria || null,
      reu_preso: reuPreso || null,
      reu_preso_normalizado: reuPreso ? isYesValue(reuPreso) : null,
      prazo: prazo || null,
      prazo_dias: prazoDias.trim() ? Number(prazoDias) : null,
      prazo_data_final: prazo || null,
      prazo_manual: prazoManual,
      data_fato: dataFato || null,
      data_instauracao: dataInstauracao || null,
      tipo: tipo || null,
      tipo_procedimento_normalizado: normalizedType,
      prioridade: prioridade || null,
      prioridade_operacional: normalizePriority(prioridade),
      gravidade: normalizeCaseCategory(gravidade, "Outro"),
      categoria_criminal: normalizedCategory,
      status_diligencias: null,
      status_tag_id: statusTagId,
      situacao: statusOptions.find((tag) => tag.id === statusTagId)?.name || situacao || null,
      elucidado: elucidado || null,
      cvli_elucidado: isCvli && elucidado ? isYesValue(elucidado) : null,
      data_elucidacao: isCvli && isYesValue(elucidado) ? dataElucidacao || null : null,
      houve_arma_fogo: houveArmaDeFogo || null,
      arma_utilizada: armaUtilizada || null,
      delegado_responsavel: null,
      equipe: null,
      equipe_responsavel: null,
      escrivao: null,
      bairro: bairro.trim() || null,
      distrito: cidade.trim() || null,
      cidade: cidade.trim() || null,
      motivacao: motivacao.trim() || null,
      faccao: vinculadoFaccao || null,
      nome_faccao: nomeFaccao.trim() || null,
      diligencias_pendentes: diligenciasPendentes.trim() || null,
      observacoes: null,
      medida_protetiva: null,
      medida_protetiva_normalizada: null,
      numero_processo_medida: null,
      relatorio_status: null,
      relatorio_enviado: null,
      data_relatorio: null,
      data_envio_relatorio: null,
      representacoes_legais: null,
    };
    try {
      const created = await createInquerito(payload);
      let tagsWarning = false;
      try {
        await replaceInqueritoTags(created.id, selectedTagIds);
      } catch (tagsError) {
        tagsWarning = true;
        console.warn("[inqueritos:tags] Registro salvo sem vínculos de tags", tagsError);
      }
      const pessoasPreenchidas = pessoas
        .filter((pessoa) => pessoa.nome.trim())
        .map((pessoa, ordem) => ({
          papel: pessoa.papel,
          nome: pessoa.nome.trim(),
          observacao: pessoa.observacao.trim() || null,
          ordem,
        }));
      let pessoasWarning = false;
      if (pessoasPreenchidas.length > 0) {
        try {
          await replaceInqueritoPessoas(created.id, pessoasPreenchidas);
        } catch (pessoasError) {
          pessoasWarning = true;
          console.warn(
            "[inqueritos:pessoas] Registro principal salvo sem pessoas adicionais",
            pessoasError,
          );
        }
      }
      setFeedback(
        pessoasWarning || tagsWarning
          ? "Procedimento salvo, mas alguns vínculos complementares precisam ser conferidos."
          : "Procedimento salvo com sucesso.",
      );
      navigate({ to: "/inqueritos/$caseId", params: { caseId: created.id } });
    } catch (error) {
      const isRlsError =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error.code === "42501" || error.code === "PGRST301");
      setErro(
        isRlsError
          ? "Permissão negada ao inserir no Supabase (RLS). Verifique as políticas de INSERT da tabela public.inqueritos para a chave pública."
          : "Falha ao salvar no Supabase.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (checkingAccess)
    return (
      <AppLayout>
        <p className="text-sm text-muted-foreground">Verificando permissões...</p>
      </AppLayout>
    );

  if (!canCreateCases(profile))
    return (
      <AppLayout>
        <div className="space-y-3">
          <h1 className="text-xl font-bold">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground">
            Seu perfil não possui permissão para criar procedimentos policiais.
          </p>
        </div>
      </AppLayout>
    );

  return (
    <AppLayout>
      <PageHeader
        title="Novo Procedimento Policial"
        subtitle="Identificação, classificação e fluxo operacional"
        showActions={false}
      />

      <form className="space-y-5 max-w-6xl pb-6" onSubmit={handleSubmit}>
        <SectionCard title="Identificação do Procedimento">
          <Field
            label="PPE"
            placeholder="Ex.: 001/2026-DPPC"
            value={ppe}
            onChange={(e) => setPpe(e.target.value)}
          />
          <OptionSelect
            label="Origem do registro"
            options={OCCURRENCE_ORIGIN_OPTIONS}
            value={origemRegistro}
            onChange={(value) => setOrigemRegistro(value as OccurrenceOrigin)}
          />
          {checkingPpe && (
            <InlineNotice>Verificando ocorrências existentes com este PPE...</InlineNotice>
          )}
          {!checkingPpe && ppeMatches.length > 0 && (
            <InlineNotice tone="warning">
              Este PPE já aparece em {ppeMatches.length} ocorrência(s) ativa(s). O cadastro continua
              permitido para procedimentos migrados; confirme a origem do registro antes de salvar.
            </InlineNotice>
          )}
          <Select
            label="Tipo de Procedimento"
            value={tipo}
            onChange={setTipo}
            options={PROCEDURE_TYPE_OPTIONS.map((option) => option.label)}
          />
          <Select
            label="Visibilidade"
            options={canViewPrivateCases(profile) ? ["Público", "Privado"] : ["Público"]}
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
            onChange={(e) => setPrazoDias(e.target.value)}
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
            options={[...CASE_CATEGORY_OPTIONS]}
            value={gravidade}
            onChange={setGravidade}
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
          <Select
            label="Elucidado"
            options={["Sim", "Não"]}
            value={elucidado}
            onChange={handleElucidadoChange}
          />
          {normalizeCriminalCategory(gravidade) === "CVLI" && elucidado === "Sim" && (
            <Field
              label="Data da elucidação"
              type="date"
              value={dataElucidacao}
              onChange={(e) => setDataElucidacao(e.target.value)}
            />
          )}
          <Select
            label="Houve arma de fogo?"
            options={["Sim", "Não"]}
            value={houveArmaDeFogo}
            onChange={handleHouveArmaDeFogoChange}
          />
          {houveArmaDeFogo === "Sim" && (
            <Field
              label="Arma Utilizada"
              placeholder="Ex: revólver calibre .38"
              value={armaUtilizada}
              onChange={(e) => setArmaUtilizada(e.target.value)}
            />
          )}
        </SectionCard>

        <SectionCard title="Pessoas Envolvidas">
          <InquiryPeopleEditor value={pessoas} onChange={setPessoas} />
          <Select
            label="Autoria"
            options={["Determinada", "Desconhecida", "Sem Autoria"]}
            value={autoria}
            onChange={setAutoria}
          />
          <Select
            label="Réu Preso"
            options={["Sim", "Não"]}
            value={reuPreso}
            onChange={setReuPreso}
          />
        </SectionCard>

        <SectionCard title="Dados Operacionais">
          <Field
            label="Bairro"
            placeholder="Informe o bairro"
            value={bairro}
            onChange={(e) => setBairro(e.target.value)}
          />
          <Field
            label="Cidade"
            placeholder="Informe a cidade"
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
          />
          <Field
            label="Motivação"
            placeholder="Motivação principal"
            value={motivacao}
            onChange={(e) => setMotivacao(e.target.value)}
          />
          <Select
            label="Vinculado a Facção"
            options={["Sim", "Não", "A definir"]}
            value={vinculadoFaccao}
            onChange={handleVinculoFaccaoChange}
          />
          {isYesValue(vinculadoFaccao) && (
            <Field
              label="Nome da Facção"
              placeholder="Informe a facção vinculada"
              value={nomeFaccao}
              onChange={(e) => setNomeFaccao(e.target.value)}
            />
          )}
          <TextArea
            label="Observações e Diligências"
            rows={6}
            placeholder="Registre observações, diligências realizadas e providências pendentes..."
            value={diligenciasPendentes}
            onChange={(e) => setDiligenciasPendentes(e.target.value)}
          />
        </SectionCard>

        {(erro || feedback) && (
          <div className="space-y-2">
            {erro && (
              <p className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                {erro}
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
            onClick={() => navigate({ to: "/inqueritos" })}
            className="px-5 py-2.5 rounded-lg text-sm border border-border hover:bg-accent"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 shadow-lg shadow-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Salvando..." : "Cadastrar procedimento"}
          </button>
        </div>
      </form>
    </AppLayout>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border/60 bg-background/70 p-5 lg:p-7">
      <h2 className="text-sm font-bold tracking-[0.2em] text-primary uppercase mb-5">{title}</h2>
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
        {options.map((o) => (
          <option key={o}>{o}</option>
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
  options: readonly { value: string; label: string }[];
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <div>
      <FormFieldLabel label={label} />
      <select
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        className="w-full bg-card border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function InlineNotice({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "warning";
}) {
  const classes =
    tone === "warning"
      ? "border-amber-500/35 bg-amber-500/8 text-amber-100"
      : "border-primary/25 bg-primary/5 text-muted-foreground";

  return (
    <div className={`md:col-span-2 lg:col-span-3 rounded-lg border px-4 py-3 text-xs ${classes}`}>
      {children}
    </div>
  );
}
