import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, LoaderCircle, ShieldCheck } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { FormFieldLabel } from "@/components/FormFieldLabel";
import { PageHeader } from "@/components/PageHeader";
import { IncompleteSaveNotice } from "@/components/IncompleteSaveNotice";
import { InquiryPeopleEditor } from "@/components/InquiryPeopleEditor";
import { ProceduralTagPicker } from "@/components/ProceduralTagPicker";
import { SeizedWeaponsField } from "@/components/SeizedWeaponsField";
import { mergeMotivacaoSuggestions } from "@/lib/motivacoes";
import {
  createInquerito,
  findInqueritosByPpe,
  listKnownInqueritoBairros,
  listKnownInqueritoMotivacoes,
  replaceInqueritoPessoas,
  updateInquerito,
  type InqueritoLinkOption,
  type InqueritoPessoaInput,
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
import { normalizeCaseCategory } from "@/lib/inqueritosPriority";
import {
  OCCURRENCE_ORIGIN_OPTIONS,
  PROCEDURE_TYPE_OPTIONS,
  REPORT_STATUS_OPTIONS,
  deriveInquiryAutoria,
  deriveInquiryReuPreso,
  getInquiryRegistrationChecks,
  isYesValue,
  normalizeCriminalCategory,
  normalizePriority,
  normalizeProcedureType,
  type OccurrenceOrigin,
  type InquiryPersonFormValue,
  type RegistrationCheck,
  type ReportStatus,
} from "@/lib/operationalContracts";

export const Route = createFileRoute("/novo-caso")({
  head: () => ({ meta: [{ title: "Novo Caso — SIPI" }] }),
  component: NovoCaso,
});

const STEPS = ["Identificação", "Fato", "Local", "Pessoas", "Situação", "Revisar"];
const REVIEW_STEP = STEPS.length - 1;

// Cada pendência do contrato operacional aponta para a etapa onde é resolvida,
// para o resumo final poder levar o usuário direto ao campo que falta.
const CHECK_STEP: Record<string, number> = {
  identificacao: 0,
  origem: 0,
  visibilidade: 0,
  tipo: 0,
  "data-fato": 1,
  tipificacao: 1,
  categoria: 1,
  "resumo-fato": 1,
  "arma-fogo": 1,
  "arma-utilizada": 1,
  bairro: 2,
  cidade: 2,
  faccao: 2,
  "nome-faccao": 2,
  envolvidos: 3,
  autoria: 3,
  "reu-preso": 3,
  "data-elucidacao": 3,
  situacao: 4,
  instauracao: 4,
  prazo: 4,
};

function NovoCaso() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [erro, setErro] = useState("");
  // Cadastro já gravado cujos vínculos complementares ainda não foram aceitos.
  const [savedCaseId, setSavedCaseId] = useState<string | null>(null);
  const [pendingTagIds, setPendingTagIds] = useState<string[] | null>(null);
  const [pendingPessoas, setPendingPessoas] = useState<InqueritoPessoaInput[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [houveArmaDeFogo, setHouveArmaDeFogo] = useState("");
  const [armaUtilizada, setArmaUtilizada] = useState("");
  const [ppe, setPpe] = useState("");
  const [tagOptions, setTagOptions] = useState<ProceduralTag[]>([]);
  const [selectedTipificacaoTagIds, setSelectedTipificacaoTagIds] = useState<string[]>([]);
  const [selectedStatusTagIds, setSelectedStatusTagIds] = useState<string[]>([]);
  const [selectedGravidadeTagIds, setSelectedGravidadeTagIds] = useState<string[]>([]);
  const [resumoFato, setResumoFato] = useState("");
  const [pessoas, setPessoas] = useState<InquiryPersonFormValue[]>([]);
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
  const [statusDiligencias, setStatusDiligencias] = useState("Pendente");
  const [delegadoResponsavel, setDelegadoResponsavel] = useState("");
  const [equipe, setEquipe] = useState("");
  const [escrivao, setEscrivao] = useState("");
  const [bairro, setBairro] = useState("");
  const [bairroOptions, setBairroOptions] = useState<string[]>([]);
  const [distrito, setDistrito] = useState("");
  const [cidade, setCidade] = useState("Itabela");
  const [motivacao, setMotivacao] = useState("");
  const [motivacaoOptions, setMotivacaoOptions] = useState<string[]>(() =>
    mergeMotivacaoSuggestions(),
  );
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
  // Vêm das pessoas cadastradas — não há mais campo solto para preencher.
  const autoria = deriveInquiryAutoria(pessoas);
  const reuPreso = deriveInquiryReuPreso(pessoas);
  const statusOptions = useMemo(() => tagsByScope(tagOptions, "inquerito_status"), [tagOptions]);
  const gravidadeOptions = useMemo(
    () => tagsByScope(tagOptions, "inquerito_gravidade"),
    [tagOptions],
  );
  const tipificacaoOptions = useMemo(() => tagsByScope(tagOptions, "tipificacao"), [tagOptions]);
  const selectedStatusTags = useMemo(
    () =>
      selectedStatusTagIds
        .map((id) => statusOptions.find((tag) => tag.id === id))
        .filter(Boolean) as ProceduralTag[],
    [selectedStatusTagIds, statusOptions],
  );
  const selectedGravidadeTags = useMemo(
    () =>
      selectedGravidadeTagIds
        .map((id) => gravidadeOptions.find((tag) => tag.id === id))
        .filter(Boolean) as ProceduralTag[],
    [gravidadeOptions, selectedGravidadeTagIds],
  );
  const selectedTipificacoes = useMemo(
    () =>
      selectedTipificacaoTagIds
        .map((id) => tipificacaoOptions.find((tag) => tag.id === id))
        .filter(Boolean) as ProceduralTag[],
    [selectedTipificacaoTagIds, tipificacaoOptions],
  );
  const statusTagId = selectedStatusTags[0]?.id ?? "";
  const situacao = selectedStatusTags[0]?.name ?? "";
  const gravidade = selectedGravidadeTags[0]?.name ?? "";
  const tipificacao = selectedTipificacoes.map((tag) => tag.name).join("; ");

  const createTagOption = async (input: Parameters<typeof createProceduralTag>[0]) => {
    const created = await createProceduralTag(input);
    setTagOptions((current) =>
      current.some((tag) => tag.id === created.id) ? current : [...current, created],
    );
    return created;
  };

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
    void listProceduralTags([
      "inquerito_status",
      "inquerito_gravidade",
      "tipificacao",
      "inquerito_geral",
    ])
      .then((tags) => {
        if (!active) return;
        setTagOptions(tags);
        const defaultStatus = tags.find(
          (tag) => tag.scope === "inquerito_status" && tag.slug === "instaurado",
        );
        setSelectedStatusTagIds((current) =>
          current.length || !defaultStatus ? current : [defaultStatus.id],
        );
        // A gravidade não vem preenchida: "Outros" entrava sozinha em todo
        // cadastro e virava a classificação principal sem ninguém escolher.
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
    let active = true;
    void listKnownInqueritoBairros()
      .then((bairros) => {
        if (active) setBairroOptions(bairros);
      })
      .catch((error) => console.warn("[novo-caso:bairros]", error));
    return () => {
      active = false;
    };
  }, []);

  // Junta ao catálogo as motivações já usadas em outros procedimentos, para que
  // uma motivação nova digitada aqui vire sugestão nos próximos cadastros.
  useEffect(() => {
    let active = true;
    void listKnownInqueritoMotivacoes()
      .then((motivacoes) => {
        if (active) setMotivacaoOptions(mergeMotivacaoSuggestions(motivacoes));
      })
      .catch((error) => console.warn("[novo-caso:motivacoes]", error));
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
        elucidado: autoria === "Determinada" ? "Sim" : autoria ? "Não" : "",
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
  const pendingChecks = registrationChecks.filter((item) => !item.complete);
  const filledCount = registrationChecks.length - pendingChecks.length;

  // Cada pendência é mostrada dentro do bloco da etapa onde se resolve, em vez
  // de uma lista solta no fim que repetia os campos vazios do resumo.
  const pendingByStep = useMemo(() => {
    const groups: Record<number, RegistrationCheck[]> = {};
    for (const item of pendingChecks) {
      const index = CHECK_STEP[item.id] ?? 0;
      (groups[index] ??= []).push(item);
    }
    return groups;
  }, [pendingChecks]);

  const reviewGroups: Array<{ step: number; title: string; rows: Array<[string, string]> }> = [
    {
      step: 0,
      title: "Identificação",
      rows: [
        ["PPE", ppe],
        ["Origem do registro", origemRegistro],
        ["Tipo de procedimento", tipo],
        ["Visibilidade", visibilidade],
      ],
    },
    {
      step: 1,
      title: "Fato",
      rows: [
        ["Data do fato", dataFato],
        ["Tipificações", selectedTipificacoes.map((tag) => tag.name).join("; ")],
        ["Gravidade", selectedGravidadeTags.map((tag) => tag.name).join("; ")],
        ["Resumo do fato", resumoFato],
        ["Arma de fogo", houveArmaDeFogo === "Sim" ? armaUtilizada || "Sim" : houveArmaDeFogo],
      ],
    },
    {
      step: 2,
      title: "Local e motivação",
      rows: [
        ["Bairro", bairro],
        ["Cidade", cidade],
        ["Motivação", motivacao],
        ["Facção", isYesValue(vinculadoFaccao) ? nomeFaccao || "Sim" : vinculadoFaccao],
      ],
    },
    {
      step: 3,
      title: "Pessoas",
      rows: [
        [
          "Pessoas cadastradas",
          pessoas
            .filter((pessoa) => pessoa.nome.trim())
            .map((pessoa) => pessoa.nome.trim())
            .join(", "),
        ],
        ["Autoria", autoria],
        ["Réu preso", reuPreso],
        ["Data da elucidação", dataElucidacao],
      ],
    },
    {
      step: 4,
      title: "Situação e prazos",
      rows: [
        ["Status", selectedStatusTags.map((tag) => tag.name).join("; ")],
        ["Data de instauração", dataInstauracao],
        ["Prazo (dias)", prazoDias],
        ["Data final", prazo],
        ["Observações e diligências", diligenciasPendentes],
      ],
    },
  ];

  const handleHouveArmaDeFogoChange = (value: string) => {
    setHouveArmaDeFogo(value);
    if (value !== "Sim") {
      setArmaUtilizada("");
    }
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

  const pendingLinksLabel = [
    pendingTagIds ? "as tags" : null,
    pendingPessoas ? "as pessoas envolvidas" : null,
  ]
    .filter(Boolean)
    .join(" e ");

  const goToStep = (index: number) => {
    setStep(Math.max(0, Math.min(REVIEW_STEP, index)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Só antecipa o que o cadastro já exigia no fim: nada vira obrigatório agora.
  const blockingMessageForStep = (index: number) => {
    if (index === 1) {
      if (selectedTipificacoes.length === 0) return "Adicione ao menos uma tipificação.";
      if (selectedGravidadeTags.length === 0) return "Adicione ao menos uma gravidade do fato.";
    }
    if (index === 4 && !statusTagId) return "Selecione o status do procedimento.";
    return "";
  };

  const handleNext = () => {
    const message = blockingMessageForStep(step);
    if (message) {
      setErro(message);
      return;
    }
    setErro("");
    goToStep(step + 1);
  };

  // Grava tags e pessoas e guarda o que falhou, para o usuário reenviar só isso.
  const linkComplements = async (
    caseId: string,
    tagIds: string[] | null,
    pessoasPreenchidas: InqueritoPessoaInput[] | null,
  ) => {
    let tagsFailed = false;
    if (tagIds) {
      try {
        await replaceInqueritoTags(caseId, tagIds);
      } catch (tagsError) {
        tagsFailed = true;
        console.warn("[inqueritos:tags] Registro salvo sem vínculos de tags", tagsError);
      }
    }

    let pessoasFailed = false;
    if (pessoasPreenchidas) {
      try {
        await replaceInqueritoPessoas(caseId, pessoasPreenchidas);
      } catch (pessoasError) {
        pessoasFailed = true;
        console.warn(
          "[inqueritos:pessoas] Registro principal salvo sem pessoas adicionais",
          pessoasError,
        );
      }
    }

    setPendingTagIds(tagsFailed ? tagIds : null);
    setPendingPessoas(pessoasFailed ? pessoasPreenchidas : null);
    return tagsFailed || pessoasFailed;
  };

  const retryPendingLinks = async () => {
    if (!savedCaseId) return;
    setLoading(true);
    setErro("");
    try {
      const linksFailed = await linkComplements(savedCaseId, pendingTagIds, pendingPessoas);
      if (!linksFailed) {
        setFeedback("Procedimento salvo com sucesso.");
        navigate({ to: "/inqueritos/$caseId", params: { caseId: savedCaseId } });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading || !canCreateCases(profile)) return;
    // Enter no meio do formulário avança a etapa em vez de tentar registrar.
    if (step < REVIEW_STEP) {
      handleNext();
      return;
    }
    setErro("");
    setFeedback("");
    if (selectedTipificacoes.length === 0) {
      setErro("Adicione ao menos uma tipificação.");
      goToStep(1);
      return;
    }
    if (selectedGravidadeTags.length === 0) {
      setErro("Adicione ao menos uma gravidade do fato.");
      goToStep(1);
      return;
    }
    if (!statusTagId) {
      setErro("Selecione o status do procedimento.");
      goToStep(4);
      return;
    }
    if (blockingChecks.length > 0) {
      setErro(`Revise antes de salvar: ${blockingChecks.map((item) => item.label).join("; ")}.`);
      goToStep(CHECK_STEP[blockingChecks[0].id] ?? 0);
      return;
    }
    setLoading(true);
    const normalizedType = normalizeProcedureType(tipo);
    const normalizedCategory = normalizeCriminalCategory(
      normalizeCaseCategory(gravidade, "Outros"),
    );
    const isCvli = normalizedCategory === "CVLI";
    const autoriaDeterminada = autoria === "Determinada";
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
      gravidade: normalizeCaseCategory(gravidade, "Outros"),
      categoria_criminal: normalizedCategory,
      status_diligencias: null,
      status_tag_id: statusTagId,
      situacao: statusOptions.find((tag) => tag.id === statusTagId)?.name || situacao || null,
      elucidado: autoria ? (autoriaDeterminada ? "Sim" : "Não") : null,
      cvli_elucidado: isCvli && autoria ? autoriaDeterminada : null,
      data_elucidacao: isCvli && autoriaDeterminada ? dataElucidacao || null : null,
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
      // Se o cadastro já foi gravado numa tentativa anterior (só os vínculos
      // falharam), atualiza o mesmo procedimento em vez de criar outro.
      const created = savedCaseId
        ? await updateInquerito(savedCaseId, payload)
        : await createInquerito(payload);
      setSavedCaseId(created.id);

      const pessoasPreenchidas = pessoas
        .filter((pessoa) => pessoa.nome.trim())
        .map((pessoa, ordem) => ({
          papel: pessoa.papel,
          nome: pessoa.nome.trim(),
          observacao: pessoa.observacao.trim() || null,
          autoria_determinada: pessoa.autoriaDeterminada,
          preso: pessoa.preso,
          ordem,
        }));
      const linksFailed = await linkComplements(
        created.id,
        [...selectedTipificacaoTagIds, ...selectedStatusTagIds, ...selectedGravidadeTagIds],
        pessoasPreenchidas.length ? pessoasPreenchidas : null,
      );
      // Com vínculo pendente o usuário fica na tela: o aviso não sobrevive à
      // navegação e o cadastro ficaria incompleto sem ninguém perceber.
      if (linksFailed) return;

      setFeedback("Procedimento salvo com sucesso.");
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
      {/* Cabeçalho e janela compartilham a mesma largura e ficam centralizados,
          para o cadastro não ficar colado na borda esquerda em telas largas. */}
      <div className="mx-auto w-full max-w-6xl">
        <PageHeader
          title="Novo Procedimento Policial"
          subtitle="Identificação, classificação e fluxo operacional"
          showActions={false}
        />

        <ol className="relative z-10 grid grid-cols-2 gap-2 rounded-t-3xl border border-b-0 border-border/80 bg-card/75 p-3 backdrop-blur-sm sm:grid-cols-3 md:p-4 lg:grid-cols-6">
          {STEPS.map((label, index) => (
            <li key={label}>
              <button
                type="button"
                onClick={() => goToStep(index)}
                aria-current={step === index ? "step" : undefined}
                className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition ${
                  step === index
                    ? "border-primary/50 bg-primary/15 text-primary shadow-[0_0_18px_rgba(34,197,94,0.08)]"
                    : index < step
                      ? "border-success/35 bg-success/5 text-success"
                      : "border-border bg-card/70 text-muted-foreground"
                }`}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-[10px]">
                  {index < step ? <Check className="h-3 w-3" /> : index + 1}
                </span>
                <span className="truncate">{label}</span>
              </button>
            </li>
          ))}
        </ol>

        <form
          className="sipi-wizard-window relative -mt-px space-y-5 rounded-b-3xl border border-border/80 bg-card/75 p-4 pt-5 backdrop-blur-sm md:p-6 md:pt-5"
          onSubmit={handleSubmit}
        >
          {step === 0 && (
            <SectionCard title="1. Identificação do Procedimento">
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
                  Este PPE já aparece em {ppeMatches.length} ocorrência(s) ativa(s). O cadastro
                  continua permitido para procedimentos migrados; confirme a origem do registro
                  antes de salvar.
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
                options={canViewPrivateCases(profile) ? ["Público", "Sigiloso"] : ["Público"]}
                value={visibilidade}
                onChange={setVisibilidade}
              />
            </SectionCard>
          )}

          {step === 1 && (
            <SectionCard title="2. O Fato">
              <Field
                label="Data do Fato"
                type="date"
                value={dataFato}
                onChange={(e) => setDataFato(e.target.value)}
              />
              <ProceduralTagPicker
                label="Tipificações"
                hint="Adicione um ou mais crimes. Cada tipificação poderá ser usada em filtros e relatórios."
                options={tipificacaoOptions}
                value={selectedTipificacaoTagIds}
                onChange={setSelectedTipificacaoTagIds}
                onCreate={createTagOption}
                createScope="tipificacao"
                canCreate={canManageProceduralTags(profile)}
                placeholder="Busque ou crie uma tipificação"
              />
              <ProceduralTagPicker
                label="Gravidade do fato"
                hint="Selecione uma ou mais gravidades. A primeira será a classificação principal do procedimento."
                options={gravidadeOptions}
                value={selectedGravidadeTagIds}
                onChange={setSelectedGravidadeTagIds}
                onCreate={createTagOption}
                createScope="inquerito_gravidade"
                canCreate={canManageProceduralTags(profile)}
                placeholder="Busque ou crie uma gravidade"
              />
              <TextArea
                label="Resumo do Fato"
                rows={5}
                placeholder="Registre, de forma objetiva, o fato que originou o procedimento..."
                value={resumoFato}
                onChange={(event) => setResumoFato(event.target.value)}
              />
              <SeizedWeaponsField
                checked={houveArmaDeFogo === "Sim"}
                onCheckedChange={(checked) => handleHouveArmaDeFogoChange(checked ? "Sim" : "Não")}
                value={armaUtilizada}
                onValueChange={setArmaUtilizada}
              />
            </SectionCard>
          )}

          {step === 2 && (
            <SectionCard title="3. Local e Motivação">
              <Field
                label="Bairro"
                placeholder="Informe ou selecione um bairro já utilizado"
                list="novo-caso-bairros"
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
              />
              <datalist id="novo-caso-bairros">
                {bairroOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
              <Field
                label="Cidade"
                placeholder="Ex.: Itabela"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
              />
              <Field
                label="Motivação"
                placeholder="Digite ou escolha uma motivação sugerida"
                list="novo-caso-motivacoes"
                value={motivacao}
                onChange={(e) => setMotivacao(e.target.value)}
              />
              <datalist id="novo-caso-motivacoes">
                {motivacaoOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
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
            </SectionCard>
          )}

          {step === 3 && (
            <SectionCard title="4. Pessoas Envolvidas">
              <InquiryPeopleEditor value={pessoas} onChange={setPessoas} />
              {/* Autoria e réu preso deixaram de ser perguntados soltos: saem do
                  que foi informado em cada investigado. Aqui fica só o resultado. */}
              <div className="md:col-span-2 lg:col-span-3">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border bg-card px-4 py-3 text-sm">
                  <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Resultado para o procedimento
                  </span>
                  <span>
                    Autoria: <strong className="font-semibold">{autoria || "não informada"}</strong>
                  </span>
                  <span>
                    Réu preso:{" "}
                    <strong className="font-semibold">{reuPreso || "não informado"}</strong>
                  </span>
                </div>
              </div>
              {normalizeCriminalCategory(gravidade) === "CVLI" && autoria === "Determinada" && (
                <Field
                  label="Data da elucidação"
                  type="date"
                  value={dataElucidacao}
                  onChange={(e) => setDataElucidacao(e.target.value)}
                />
              )}
            </SectionCard>
          )}

          {step === 4 && (
            <SectionCard title="5. Situação e Prazos">
              <ProceduralTagPicker
                label="Status do procedimento"
                hint="Selecione um ou mais status. O primeiro será o status principal e continuará no histórico."
                options={statusOptions}
                value={selectedStatusTagIds}
                onChange={setSelectedStatusTagIds}
                onCreate={createTagOption}
                createScope="inquerito_status"
                canCreate={canManageProceduralTags(profile)}
                placeholder="Busque ou crie um status"
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
              <TextArea
                label="Observações e Diligências"
                rows={6}
                placeholder="Registre observações, diligências realizadas e providências pendentes..."
                value={diligenciasPendentes}
                onChange={(e) => setDiligenciasPendentes(e.target.value)}
              />
            </SectionCard>
          )}

          {step === REVIEW_STEP && (
            <SectionCard title="6. Revisar e Registrar">
              <div className="space-y-3 md:col-span-2 lg:col-span-3">
                <ReviewProgress filled={filledCount} total={registrationChecks.length} />

                {reviewGroups.map((group) => (
                  <ReviewGroup
                    key={group.step}
                    title={group.title}
                    rows={group.rows}
                    pending={pendingByStep[group.step] ?? []}
                    onEdit={() => goToStep(group.step)}
                  />
                ))}
              </div>
            </SectionCard>
          )}

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

          {savedCaseId && pendingLinksLabel ? (
            <IncompleteSaveNotice
              title={`Procedimento salvo, mas ${pendingLinksLabel} não foram vinculadas.`}
              description="O procedimento já está gravado — não é preciso salvar de novo. Tente vincular novamente ou abra o procedimento e ajuste por lá."
              busy={loading}
              retryLabel="Tentar vincular novamente"
              onRetry={() => void retryPendingLinks()}
              onContinue={() =>
                navigate({ to: "/inqueritos/$caseId", params: { caseId: savedCaseId } })
              }
            />
          ) : null}

          <div className="flex flex-col-reverse gap-3 border-t border-border/80 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => (step === 0 ? navigate({ to: "/inqueritos" }) : goToStep(step - 1))}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border px-5 text-sm font-semibold hover:bg-accent"
            >
              {step === 0 ? (
                "Cancelar"
              ) : (
                <>
                  <ArrowLeft className="h-4 w-4" /> Anterior
                </>
              )}
            </button>
            {step < REVIEW_STEP ? (
              <button
                type="button"
                onClick={handleNext}
                className="sipi-cta-green inline-flex h-11 items-center justify-center gap-2 rounded-lg px-6 text-sm font-bold"
              >
                Próximo <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="sipi-cta-green sipi-cta-neon inline-flex h-11 items-center justify-center gap-2 rounded-lg px-6 text-sm font-black tracking-wide disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                {loading ? "Registrando..." : "Registrar Inquérito"}
              </button>
            )}
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

// Barra do topo da revisão: dá a noção de completude antes de o usuário descer
// pelos blocos.
function ReviewProgress({ filled, total }: { filled: number; total: number }) {
  const missing = Math.max(0, total - filled);
  const percent = total > 0 ? Math.round((filled / total) * 100) : 100;

  return (
    <div className="rounded-xl border border-border/70 bg-card/60 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-bold">
          {missing === 0
            ? "Tudo preenchido"
            : missing === 1
              ? "Falta 1 informação recomendada"
              : `Faltam ${missing} informações recomendadas`}
        </p>
        <p className="text-xs text-muted-foreground">
          {filled} de {total} preenchidas
        </p>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-border/60">
        <div
          className="h-full rounded-full bg-success transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      {missing > 0 && (
        <p className="mt-2.5 text-xs text-muted-foreground">
          Nada disso impede o registro. Toque em um item pendente para voltar ao campo.
        </p>
      )}
    </div>
  );
}

// Resumo de uma etapa. Só entra o que foi preenchido — o que falta aparece como
// pendência clicável no rodapé do próprio bloco, e não como uma fila de traços.
function ReviewGroup({
  title,
  rows,
  pending,
  onEdit,
}: {
  title: string;
  rows: Array<[string, string]>;
  pending: RegistrationCheck[];
  onEdit: () => void;
}) {
  const filled = rows.filter(([, value]) => value.trim().length > 0);

  return (
    <section className="overflow-hidden rounded-xl border border-border/70 bg-card/60">
      <header className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-2.5">
        <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-foreground">
          {title}
          {pending.length > 0 && (
            <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold tracking-normal text-warning">
              {pending.length}
            </span>
          )}
        </h3>
        <button
          type="button"
          onClick={onEdit}
          className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold transition hover:border-primary/45 hover:text-primary"
        >
          Editar
        </button>
      </header>

      {filled.length > 0 ? (
        <dl className="grid grid-cols-1 gap-x-6 px-4 py-3 sm:grid-cols-2">
          {filled.map(([label, value]) => (
            <div key={label} className="flex min-w-0 items-baseline justify-between gap-3 py-1">
              <dt className="shrink-0 text-[11px] text-muted-foreground">{label}</dt>
              <dd className="min-w-0 truncate text-right text-xs font-semibold" title={value}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="px-4 py-3 text-xs text-muted-foreground">Nada preenchido nesta etapa.</p>
      )}

      {pending.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 border-t border-border/50 bg-warning/[0.06] px-4 py-3">
          {pending.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={onEdit}
                className="rounded-lg border border-warning/30 bg-background/50 px-2.5 py-1 text-[11px] font-medium text-warning/90 transition hover:border-warning/60 hover:text-warning"
              >
                {item.label.replace(/\.$/, "")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="sipi-shimmer rounded-xl border border-border/60 bg-background/70 p-5 lg:p-7">
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
