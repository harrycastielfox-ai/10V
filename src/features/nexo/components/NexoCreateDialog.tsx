import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CornerDownLeft,
  MapPinned,
  RotateCcw,
  Save,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type {
  NexoOrganizacao,
  NexoOrganizacaoInput,
  NexoPessoa,
  NexoPessoaInput,
  NexoTerritorio,
  NexoTerritorioInput,
} from "../nexoTypes";
import { findPossibleNexoPersonDuplicates } from "../nexoPersonDuplicates";
import { NexoTerritoryMap } from "./NexoTerritoryMap";
import { NexoPersonWizard, PersonWizardProgress } from "./NexoPersonWizard";

export type CreateKind = "territorio" | "organizacao" | "pessoa";
const PERSON_STEP_COUNT = 6;

const field =
  "h-11 w-full rounded-xl border border-[#d9e5ed] bg-white px-3 text-sm text-[#18384f] outline-none placeholder:text-[#567184] focus:border-[#33a0b4]";
const textarea =
  "min-h-24 w-full rounded-xl border border-[#d9e5ed] bg-white px-3 py-2 text-sm text-[#18384f] outline-none placeholder:text-[#567184] focus:border-[#33a0b4]";

function registrationSnapshot(
  organization: NexoOrganizacaoInput,
  person: NexoPessoaInput,
  territory: NexoTerritorioInput,
) {
  const fileKey = (file: File | null) =>
    file ? `${file.name}:${file.size}:${file.lastModified}` : null;
  return JSON.stringify({
    organization,
    person: {
      ...person,
      foto_perfil: fileKey(person.foto_perfil),
      foto_relatorio: fileKey(person.foto_relatorio),
    },
    territory,
  });
}

function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "sm:col-span-2" : ""}>
      <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[.11em] text-[#768b9d]">
        {label}
      </span>
      {children}
    </label>
  );
}

const emptyOrg: NexoOrganizacaoInput = {
  nome: "",
  sigla: "",
  status: "monitoramento",
  cor: "#168da4",
  descricao: "",
  area_atuacao: "",
  nivel_risco: "moderado",
};
const emptyPerson: NexoPessoaInput = {
  nome: "",
  apelido: "",
  cpf: "",
  rg: "",
  data_nascimento: "",
  naturalidade: "",
  nome_mae: "",
  nome_pai: "",
  nome_social: "",
  sexo: "",
  raca_cor: "",
  estado_civil: "",
  nacionalidade: "Brasileira",
  escolaridade: "",
  profissao: "",
  idade_aproximada: false,
  idade_aproximada_valor: null,
  em_situacao_rua: false,
  usa_tornozeleira: false,
  altura_cm: null,
  tipo_fisico: "",
  estado_aparente: "",
  sinais_particulares: "",
  documentos_extras: [],
  contatos: [],
  telefone: "",
  observacoes: "",
  endereco: {
    logradouro: "",
    numero: "",
    bairro: "",
    municipio: "Itabela",
    uf: "BA",
    ponto_referencia: "",
    como_chegar: "",
    link_navegacao: "",
    latitude: null,
    longitude: null,
  },
  organizacao_id: "",
  usar_local_faccao: false,
  vinculo_status: "nao_confirmado",
  vinculo_funcao: "",
  vinculo_confianca: 0,
  fonte_resumo: "",
  foto_perfil: null,
  foto_relatorio: null,
};
const emptyTerritory: NexoTerritorioInput = {
  organizacao_id: "",
  bairro: "",
  categoria: "area_influencia",
  classificacao: "em_analise",
  confianca: 0,
  fonte_resumo: "",
  observacoes: "",
  logradouro: "",
  numero: "",
  complemento: "",
  municipio: "Itabela",
  uf: "BA",
  ponto_referencia: "",
  link_navegacao: "",
  pontos: [],
};

export function NexoCreateDialog({
  kind,
  initialOrganizationId = null,
  initialOrganization = null,
  initialPerson = null,
  organizations,
  people,
  territories,
  onClose,
  onSaveOrganization,
  onSavePerson,
  onSaveTerritory,
  onResolvePersonConflict,
}: {
  kind: CreateKind;
  initialOrganizationId?: string | null;
  initialOrganization?: NexoOrganizacao | null;
  initialPerson?: NexoPessoa | null;
  organizations: NexoOrganizacao[];
  people: NexoPessoa[];
  territories: NexoTerritorio[];
  onClose: () => void;
  onSaveOrganization: (input: NexoOrganizacaoInput) => Promise<void>;
  onSavePerson: (input: NexoPessoaInput, creationRequestId: string) => Promise<void>;
  onSaveTerritory: (input: NexoTerritorioInput) => Promise<void>;
  onResolvePersonConflict: () => Promise<void>;
}) {
  const initialLink = initialPerson?.vinculos.find((link) => link.status !== "desvinculado");
  const [organization, setOrganization] = useState<NexoOrganizacaoInput>(() =>
    initialOrganization
      ? {
          nome: initialOrganization.nome,
          sigla: initialOrganization.sigla || "",
          status: initialOrganization.status,
          cor: initialOrganization.cor,
          descricao: initialOrganization.descricao || "",
          area_atuacao: initialOrganization.area_atuacao || "",
          nivel_risco: initialOrganization.nivel_risco,
        }
      : emptyOrg,
  );
  const [person, setPerson] = useState<NexoPessoaInput>(() => ({
    ...emptyPerson,
    ...(initialPerson
      ? {
          nome: initialPerson.nome,
          apelido: initialPerson.apelido || "",
          cpf: initialPerson.cpf || "",
          rg: initialPerson.rg || "",
          data_nascimento: initialPerson.data_nascimento || "",
          naturalidade: initialPerson.naturalidade || "",
          nome_mae: initialPerson.nome_mae || "",
          nome_pai: initialPerson.nome_pai || "",
          nome_social: initialPerson.nome_social || "",
          sexo: initialPerson.sexo || "",
          raca_cor: initialPerson.raca_cor || "",
          estado_civil: initialPerson.estado_civil || "",
          nacionalidade: initialPerson.nacionalidade || "Brasileira",
          escolaridade: initialPerson.escolaridade || "",
          profissao: initialPerson.profissao || "",
          idade_aproximada: initialPerson.idade_aproximada,
          idade_aproximada_valor: initialPerson.idade_aproximada_valor,
          em_situacao_rua: initialPerson.em_situacao_rua,
          usa_tornozeleira: initialPerson.usa_tornozeleira,
          altura_cm: initialPerson.altura_cm,
          tipo_fisico: initialPerson.tipo_fisico || "",
          estado_aparente: initialPerson.estado_aparente || "",
          sinais_particulares: initialPerson.sinais_particulares || "",
          documentos_extras: initialPerson.documentos_extras || [],
          contatos: initialPerson.contatos || [],
          telefone: initialPerson.telefone || "",
          observacoes: initialPerson.observacoes || "",
          endereco: {
            logradouro: initialPerson.endereco?.logradouro || "",
            numero: initialPerson.endereco?.numero || "",
            bairro: initialPerson.endereco?.bairro || "",
            municipio: initialPerson.endereco?.municipio || "Itabela",
            uf: initialPerson.endereco?.uf || "BA",
            ponto_referencia: initialPerson.endereco?.ponto_referencia || "",
            como_chegar: initialPerson.endereco?.como_chegar || "",
            link_navegacao: initialPerson.endereco?.link_navegacao || "",
            latitude: initialPerson.endereco?.latitude ?? null,
            longitude: initialPerson.endereco?.longitude ?? null,
          },
          organizacao_id: initialLink?.organizacao_id || "",
          usar_local_faccao: initialPerson.usar_local_faccao,
          vinculo_status: initialLink?.status || "nao_confirmado",
          vinculo_funcao: initialLink?.funcao || "",
          vinculo_confianca: initialLink?.confianca || 0,
          fonte_resumo: initialLink?.fonte_resumo || "",
        }
      : {}),
    organizacao_id: initialLink?.organizacao_id || initialOrganizationId || "",
  }));
  const [territory, setTerritory] = useState<NexoTerritorioInput>(() => ({
    ...emptyTerritory,
    organizacao_id: initialOrganizationId || "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [personConflict, setPersonConflict] = useState(false);
  const [personStep, setPersonStep] = useState(0);
  const personCreationRequestIdRef = useRef(crypto.randomUUID());
  const acceptedDuplicateSnapshotRef = useRef("");
  const initialSnapshotRef = useRef(registrationSnapshot(organization, person, territory));
  const hasUnsavedChanges =
    registrationSnapshot(organization, person, territory) !== initialSnapshotRef.current;
  const title =
    kind === "territorio"
      ? "Marcar área de influência"
      : kind === "organizacao"
        ? initialOrganization
          ? "Editar facção"
          : "Cadastrar facção"
        : initialPerson
          ? "Editar pessoa"
          : "Cadastrar pessoa";
  const editing = Boolean(initialOrganization || initialPerson);

  useEffect(() => {
    if (!hasUnsavedChanges || saving) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasUnsavedChanges, saving]);

  function requestClose() {
    if (saving) return;
    if (
      hasUnsavedChanges &&
      !window.confirm(
        "Descartar as alterações deste cadastro? Os dados preenchidos serão perdidos.",
      )
    )
      return;
    onClose();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (kind === "pessoa" && personStep < PERSON_STEP_COUNT - 1) {
      nextPersonStep();
      return;
    }
    if (kind === "pessoa" && !person.nome.trim()) {
      setError("Informe o nome completo para continuar.");
      setPersonStep(0);
      return;
    }
    if (kind === "pessoa" && !initialPerson) {
      const personSnapshot = registrationSnapshot(organization, person, territory);
      const duplicates = findPossibleNexoPersonDuplicates(person, people);
      if (duplicates.length && acceptedDuplicateSnapshotRef.current !== personSnapshot) {
        const examples = duplicates
          .slice(0, 3)
          .map(({ person: match, reasons }) => `${match.nome} (${reasons.join(", ")})`)
          .join("\n");
        if (
          !window.confirm(
            `Encontramos cadastro(s) possivelmente duplicado(s):\n\n${examples}\n\nDeseja cadastrar mesmo assim?`,
          )
        )
          return;
        acceptedDuplicateSnapshotRef.current = personSnapshot;
      }
    }
    setError("");
    setPersonConflict(false);
    setSaving(true);
    try {
      if (kind === "territorio") await onSaveTerritory(territory);
      if (kind === "organizacao") await onSaveOrganization(organization);
      if (kind === "pessoa") await onSavePerson(person, personCreationRequestIdRef.current);
      onClose();
    } catch (cause) {
      setPersonConflict((cause as { code?: string } | null)?.code === "NEXO_EDIT_CONFLICT");
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o registro.");
    } finally {
      setSaving(false);
    }
  }

  function nextPersonStep() {
    setError("");
    if (personStep === 0 && !person.nome.trim()) {
      setError("Informe o nome completo para continuar.");
      return;
    }
    setPersonStep((current) => Math.min(current + 1, PERSON_STEP_COUNT - 1));
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[#071d30]/70 p-3 backdrop-blur-sm"
      onMouseDown={requestClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
        className={`nexo-themed max-h-[94dvh] w-full rounded-[24px] border border-[#cddfe8] bg-[#f4f8fb] shadow-[0_30px_100px_rgba(0,0,0,.35)] ${
          kind === "pessoa"
            ? "max-w-[1280px] overflow-y-auto overflow-x-hidden overscroll-contain"
            : kind === "territorio"
              ? "max-w-[1000px] overflow-y-auto"
              : "max-w-[720px] overflow-y-auto"
        }`}
      >
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-[#24445e] bg-gradient-to-r from-[#071725] via-[#0b263b] to-[#103650] px-5 py-4 text-white shadow-[0_12px_30px_-24px_rgba(3,20,34,.9)] sm:px-7">
          <button
            type="button"
            disabled={saving}
            onClick={requestClose}
            className="rounded-lg border border-white/10 p-2 text-[#b9d5e2] transition hover:bg-white/10 hover:text-white"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#69d4e7]/25 bg-[#58c8db]/15 text-[#69d8e9] shadow-inner">
            {kind === "territorio" ? (
              <MapPinned className="h-5 w-5" />
            ) : kind === "organizacao" ? (
              <Building2 className="h-5 w-5" />
            ) : (
              <UserRound className="h-5 w-5" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#66cfe0]">
              {editing ? "Atualização de registro · NEXO" : "Novo registro · NEXO"}
            </p>
            <h2 className="text-lg font-black text-white">{title}</h2>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={requestClose}
            aria-label="Fechar"
            className="rounded-lg border border-white/10 p-2 text-[#b9d5e2] transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {kind === "pessoa" ? <PersonWizardProgress step={personStep} /> : null}
        <form
          inert={saving}
          aria-busy={saving}
          onSubmit={(event) => void submit(event)}
          className={`space-y-7 p-5 sm:p-7 ${kind === "pessoa" ? "flex min-h-[440px] flex-col lg:min-h-[520px]" : ""}`}
        >
          {kind === "organizacao" ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nome da facção">
                  <input
                    required
                    className={field}
                    value={organization.nome}
                    onChange={(event) =>
                      setOrganization({ ...organization, nome: event.target.value })
                    }
                  />
                </Field>
                <Field label="Sigla">
                  <input
                    className={field}
                    value={organization.sigla}
                    onChange={(event) =>
                      setOrganization({ ...organization, sigla: event.target.value })
                    }
                  />
                </Field>
                <Field label="Situação">
                  <select
                    className={field}
                    value={organization.status}
                    onChange={(event) =>
                      setOrganization({
                        ...organization,
                        status: event.target.value as NexoOrganizacaoInput["status"],
                      })
                    }
                  >
                    <option value="monitoramento">Em monitoramento</option>
                    <option value="ativa">Ativa</option>
                    <option value="inativa">Inativa</option>
                    <option value="indeterminada">Indeterminada</option>
                  </select>
                </Field>
                <Field label="Nível de risco">
                  <select
                    className={field}
                    value={organization.nivel_risco}
                    onChange={(event) =>
                      setOrganization({
                        ...organization,
                        nivel_risco: event.target.value as NexoOrganizacaoInput["nivel_risco"],
                      })
                    }
                  >
                    <option value="baixo">Baixo</option>
                    <option value="moderado">Moderado</option>
                    <option value="alto">Alto</option>
                    <option value="critico">Crítico</option>
                  </select>
                </Field>
                <Field label="Cor no painel">
                  <input
                    type="color"
                    className={`${field} p-1`}
                    value={organization.cor}
                    onChange={(event) =>
                      setOrganization({ ...organization, cor: event.target.value })
                    }
                  />
                </Field>
                <Field label="Área de atuação descrita">
                  <input
                    className={field}
                    value={organization.area_atuacao}
                    onChange={(event) =>
                      setOrganization({ ...organization, area_atuacao: event.target.value })
                    }
                    placeholder="Ex.: setor urbano em análise"
                  />
                </Field>
                <Field label="Descrição analítica" wide>
                  <textarea
                    className={textarea}
                    value={organization.descricao}
                    onChange={(event) =>
                      setOrganization({ ...organization, descricao: event.target.value })
                    }
                  />
                </Field>
              </div>
            </>
          ) : null}

          {kind === "pessoa" ? (
            <div className="flex-1">
              <NexoPersonWizard
                step={personStep}
                person={person}
                setPerson={setPerson}
                organizations={organizations}
                initialOrganizationId={initialOrganizationId}
              />
            </div>
          ) : null}

          {kind === "territorio" ? (
            <>
              <p className="rounded-xl border border-[#cde4e9] bg-[#eaf6f7] px-4 py-3 text-xs leading-relaxed text-[#3d7180]">
                Cadastre uma área ou um ponto operacional com endereço e fonte. A marcação no mapa é
                opcional e representa uma hipótese de inteligência, não um limite oficial.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Bairro ou localidade">
                  <input
                    required
                    className={field}
                    value={territory.bairro}
                    onChange={(event) => setTerritory({ ...territory, bairro: event.target.value })}
                    placeholder="Ex.: Centro"
                  />
                </Field>
                <Field label="Categoria operacional">
                  <select
                    className={field}
                    value={territory.categoria}
                    onChange={(event) =>
                      setTerritory({
                        ...territory,
                        categoria: event.target.value as NexoTerritorioInput["categoria"],
                      })
                    }
                  >
                    <option value="area_influencia">Área de influência</option>
                    <option value="ponto_venda">Ponto de venda</option>
                    <option value="ponto_encontro">Ponto de encontro</option>
                    <option value="esconderijo">Esconderijo</option>
                    <option value="deposito">Depósito</option>
                    <option value="rota_operacional">Rota operacional</option>
                    <option value="outro">Outro</option>
                  </select>
                </Field>
                <Field label="Organização relacionada">
                  <select
                    required
                    className={field}
                    value={territory.organizacao_id}
                    onChange={(event) =>
                      setTerritory({ ...territory, organizacao_id: event.target.value })
                    }
                  >
                    <option value="">Selecione…</option>
                    {organizations.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nome}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Classificação">
                  <select
                    className={field}
                    value={territory.classificacao}
                    onChange={(event) =>
                      setTerritory({
                        ...territory,
                        classificacao: event.target.value as NexoTerritorioInput["classificacao"],
                      })
                    }
                  >
                    <option value="em_analise">Em análise</option>
                    <option value="indicativo">Indicativo</option>
                    <option value="confirmado">Confirmado</option>
                    <option value="disputado">Disputado</option>
                    <option value="historico">Histórico</option>
                  </select>
                </Field>
                <Field label="Confiança (0–100)">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className={field}
                    value={territory.confianca}
                    onChange={(event) =>
                      setTerritory({ ...territory, confianca: Number(event.target.value) })
                    }
                  />
                </Field>
                <Field label="Logradouro" wide>
                  <input
                    className={field}
                    value={territory.logradouro}
                    onChange={(event) =>
                      setTerritory({ ...territory, logradouro: event.target.value })
                    }
                    placeholder="Rua, avenida, estrada ou descrição do acesso"
                  />
                </Field>
                <Field label="Número">
                  <input
                    className={field}
                    value={territory.numero}
                    onChange={(event) => setTerritory({ ...territory, numero: event.target.value })}
                    placeholder="S/N"
                  />
                </Field>
                <Field label="Complemento">
                  <input
                    className={field}
                    value={territory.complemento}
                    onChange={(event) =>
                      setTerritory({ ...territory, complemento: event.target.value })
                    }
                  />
                </Field>
                <Field label="Município">
                  <input
                    className={field}
                    value={territory.municipio}
                    onChange={(event) =>
                      setTerritory({ ...territory, municipio: event.target.value })
                    }
                  />
                </Field>
                <Field label="UF">
                  <input
                    maxLength={2}
                    className={field}
                    value={territory.uf}
                    onChange={(event) =>
                      setTerritory({ ...territory, uf: event.target.value.toUpperCase() })
                    }
                  />
                </Field>
                <Field label="Ponto de referência">
                  <input
                    className={field}
                    value={territory.ponto_referencia}
                    onChange={(event) =>
                      setTerritory({ ...territory, ponto_referencia: event.target.value })
                    }
                  />
                </Field>
                <Field label="Link Google Maps / navegação">
                  <input
                    type="url"
                    className={field}
                    value={territory.link_navegacao}
                    onChange={(event) =>
                      setTerritory({ ...territory, link_navegacao: event.target.value })
                    }
                    placeholder="https://maps.google.com/..."
                  />
                </Field>
                <Field label="Fonte resumida" wide>
                  <textarea
                    required
                    className={textarea}
                    value={territory.fonte_resumo}
                    onChange={(event) =>
                      setTerritory({ ...territory, fonte_resumo: event.target.value })
                    }
                    placeholder="Descreva a origem e a data da informação."
                  />
                </Field>
                <Field label="Observações" wide>
                  <textarea
                    className={textarea}
                    value={territory.observacoes}
                    onChange={(event) =>
                      setTerritory({ ...territory, observacoes: event.target.value })
                    }
                  />
                </Field>
              </div>
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-[#1d425c]">Área visual opcional</h3>
                    <p className="text-xs text-[#8a9dab]">
                      Para um bairro, clique em três ou mais pontos. Locais pontuais podem ficar sem
                      desenho.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setTerritory({ ...territory, pontos: territory.pontos.slice(0, -1) })
                    }
                    disabled={!territory.pontos.length}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#d4e2e9] bg-white px-2 py-1.5 text-xs text-[#557188] disabled:opacity-50"
                  >
                    <CornerDownLeft className="h-3.5 w-3.5" /> Desfazer
                  </button>
                </div>
                <NexoTerritoryMap
                  organizations={organizations}
                  territories={territories}
                  selectedId={null}
                  onSelect={() => {}}
                  drawingPoints={territory.pontos}
                  onMapClick={(point) =>
                    setTerritory((current) => ({
                      ...current,
                      pontos: [...current.pontos, point],
                    }))
                  }
                />
                <div className="mt-2 flex items-center justify-between text-xs text-[#8a9dab]">
                  <span>{territory.pontos.length} ponto(s) marcados</span>
                  <button
                    type="button"
                    onClick={() => setTerritory({ ...territory, pontos: [] })}
                    className="inline-flex items-center gap-1 hover:text-[#1f637e]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Limpar desenho
                  </button>
                </div>
              </div>
            </>
          ) : null}
          {error ? (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"
            >
              <p>{error}</p>
              {personConflict ? (
                <button
                  type="button"
                  className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-2 font-bold text-red-700 hover:bg-red-100"
                  onClick={async () => {
                    if (
                      !window.confirm(
                        "Descartar suas alterações e carregar a versão mais recente desta ficha?",
                      )
                    )
                      return;
                    setSaving(true);
                    try {
                      await onResolvePersonConflict();
                    } catch (cause) {
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : "Não foi possível carregar a versão mais recente.",
                      );
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  Descartar e carregar versão atual
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#dbe6ed] bg-white p-4">
            {kind === "pessoa" && personStep > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setPersonStep((current) => Math.max(current - 1, 0));
                }}
                className="nexo-action-secondary"
              >
                <ArrowLeft className="h-4 w-4" /> Anterior
              </button>
            ) : (
              <span />
            )}
            {kind === "pessoa" && personStep < PERSON_STEP_COUNT - 1 ? (
              <button
                key="person-next-step"
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  nextPersonStep();
                }}
                className="nexo-action-primary"
              >
                Próximo <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                key="save-record"
                type="submit"
                disabled={saving}
                className="nexo-action-primary"
              >
                <Save className="h-4 w-4" /> {saving ? "Salvando…" : "Salvar registro"}
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
