import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  FileText,
  Link2,
  MapPin,
  Plus,
  Save,
  Scale,
  Search,
  Unlink,
  UserRound,
} from "lucide-react";
import { useAppProfile } from "@/components/AppProfileContext";
import { canManageBos } from "@/lib/authz";
import { createBo, listBoResponsaveis, listBos, updateBo } from "@/lib/repositories/boRepository";
import { listProceduralTags } from "@/lib/repositories/proceduralTagsRepository";
import { getInqueritoById, searchInqueritosForLink } from "@/lib/repositories/inqueritosRepository";
import {
  getRepresentacaoById,
  searchRepresentacoesForLink,
} from "@/lib/repositories/representacoesRepository";
import {
  BO_STATUS_OPTIONS,
  validateBoPayload,
  type BoLinkType,
  type BoLocationCategory,
  type BoPayload,
  type BoRecord,
  type BoStatus,
} from "../boTypes";
import {
  applyBoDiligenceSuggestion,
  applyBoInfractionSuggestion,
  getActiveBoDiligenceQuery,
  getActiveBoInfractionQuery,
  getBoDiligenceSuggestions,
  getBoInfractionSuggestions,
  getBoResponsibleSuggestions,
} from "../boSuggestions";
import { BO_DILIGENCE_SUGGESTIONS } from "../boDiligenceSuggestions";

type LinkOption = { id: string; title: string; subtitle: string };
type ProcedureLinkType = Exclude<BoLinkType, "none">;

export default function BoFormPage({ initial }: { initial?: BoRecord }) {
  const profile = useAppProfile();
  const navigate = useNavigate();
  const editing = Boolean(initial);
  const [numero, setNumero] = useState(initial?.numero_bo ?? "");
  const [status, setStatus] = useState<BoStatus>(initial?.status ?? "Pendente");
  const [infracao, setInfracao] = useState(initial?.infracao_penal ?? "");
  const [diligencias, setDiligencias] = useState(initial?.diligencias_pendentes ?? "");
  const [responsavel, setResponsavel] = useState(initial?.responsavel_nome ?? profile.nome ?? "");
  const [observacao, setObservacao] = useState(initial?.observacao ?? "");
  const [localCategoria, setLocalCategoria] = useState<BoLocationCategory | "">(
    initial?.local_categoria ?? "",
  );
  const [localLogradouro, setLocalLogradouro] = useState(initial?.local_logradouro ?? "");
  const [localNumero, setLocalNumero] = useState(initial?.local_numero ?? "");
  const [localBairro, setLocalBairro] = useState(initial?.local_bairro ?? "");
  const [localMunicipio, setLocalMunicipio] = useState(initial?.local_municipio ?? "Itabela");
  const [localUf, setLocalUf] = useState(initial?.local_uf ?? "BA");
  const [localReferencia, setLocalReferencia] = useState(initial?.local_ponto_referencia ?? "");
  const [localLink, setLocalLink] = useState(initial?.local_link_navegacao ?? "");
  const [activeLinkType, setActiveLinkType] = useState<ProcedureLinkType | null>(null);
  const [inqueritoId, setInqueritoId] = useState(initial?.inquerito_id ?? "");
  const [representacaoId, setRepresentacaoId] = useState(initial?.representacao_id ?? "");
  const [selectedInquerito, setSelectedInquerito] = useState<LinkOption | null>(null);
  const [selectedRepresentacao, setSelectedRepresentacao] = useState<LinkOption | null>(null);
  const [linkQuery, setLinkQuery] = useState("");
  const [linkResults, setLinkResults] = useState<LinkOption[]>([]);
  const [linkLoading, setLinkLoading] = useState(false);
  const [responsaveis, setResponsaveis] = useState<string[]>([]);
  const [tipificacaoOptions, setTipificacaoOptions] = useState<string[]>([]);
  const [infracaoSuggestionsOpen, setInfracaoSuggestionsOpen] = useState(false);
  const [highlightedSuggestion, setHighlightedSuggestion] = useState(0);
  const [diligenciaSuggestionsOpen, setDiligenciaSuggestionsOpen] = useState(false);
  const [responsavelSuggestionsOpen, setResponsavelSuggestionsOpen] = useState(false);
  const [highlightedResponsavel, setHighlightedResponsavel] = useState(0);
  const [highlightedDiligenciaSuggestion, setHighlightedDiligenciaSuggestion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Duas origens: quem tem login no SIED e quem já foi responsável por algum
  // B.O. Só a primeira deixava de fora servidor sem usuário no sistema.
  useEffect(() => {
    void Promise.all([
      listBoResponsaveis()
        .then((items) => items.map((item) => item.nome ?? ""))
        .catch(() => [] as string[]),
      listBos()
        .then((records) => records.map((record) => record.responsavel_nome ?? ""))
        .catch(() => [] as string[]),
    ]).then(([usuarios, deBoletins]) => {
      const nomes = [...usuarios, ...deBoletins].map((nome) => nome.trim()).filter(Boolean);
      setResponsaveis(
        [...new Set(nomes)].sort((left, right) => left.localeCompare(right, "pt-BR")),
      );
    });
  }, []);

  useEffect(() => {
    void listProceduralTags(["tipificacao"])
      .then((items) => setTipificacaoOptions(items.map((item) => item.name)))
      .catch(() => setTipificacaoOptions([]));
  }, []);

  const infracaoSuggestions = useMemo(
    () => getBoInfractionSuggestions(infracao, tipificacaoOptions),
    [infracao, tipificacaoOptions],
  );

  const chooseInfracaoSuggestion = (suggestion: string) => {
    setInfracao(applyBoInfractionSuggestion(infracao, suggestion));
    setInfracaoSuggestionsOpen(false);
    setHighlightedSuggestion(0);
  };

  const diligenciaSuggestions = useMemo(
    () => getBoDiligenceSuggestions(diligencias, [...BO_DILIGENCE_SUGGESTIONS]),
    [diligencias],
  );

  const responsavelSuggestions = useMemo(
    () => getBoResponsibleSuggestions(responsavel, responsaveis),
    [responsavel, responsaveis],
  );

  const chooseResponsavelSuggestion = (suggestion: string) => {
    setResponsavel(suggestion);
    setResponsavelSuggestionsOpen(false);
    setHighlightedResponsavel(0);
  };

  const chooseDiligenciaSuggestion = (suggestion: string) => {
    setDiligencias(applyBoDiligenceSuggestion(diligencias, suggestion));
    setDiligenciaSuggestionsOpen(false);
    setHighlightedDiligenciaSuggestion(0);
  };

  useEffect(() => {
    let cancelled = false;
    if (initial?.inquerito_id) {
      void getInqueritoById(initial.inquerito_id).then((item) => {
        if (!item || cancelled) return;
        setSelectedInquerito({
          id: item.id,
          title: item.numero_ppe || "Inquérito sem número",
          subtitle: [item.tipo_procedimento_normalizado || item.tipo, item.situacao]
            .filter(Boolean)
            .join(" · "),
        });
      });
    }
    if (initial?.representacao_id) {
      void getRepresentacaoById(initial.representacao_id).then((item) => {
        if (!item || cancelled) return;
        setSelectedRepresentacao({
          id: item.id,
          title: item.processo_judicial || item.numero_ppe || "Representação sem número",
          subtitle: [item.tipo, item.status].filter(Boolean).join(" · "),
        });
      });
    }
    return () => {
      cancelled = true;
    };
  }, [initial?.inquerito_id, initial?.representacao_id]);

  useEffect(() => {
    const activeSelection =
      activeLinkType === "inquerito" ? selectedInquerito : selectedRepresentacao;
    if (!activeLinkType || activeSelection || linkQuery.trim().length < 2) {
      setLinkResults([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLinkLoading(true);
      const request =
        activeLinkType === "inquerito"
          ? searchInqueritosForLink(linkQuery).then((items) =>
              items.map((item) => ({
                id: item.id,
                title: item.numero_ppe || "Inquérito sem número",
                subtitle: [item.tipo_procedimento_normalizado || item.tipo, item.situacao]
                  .filter(Boolean)
                  .join(" · "),
              })),
            )
          : searchRepresentacoesForLink(linkQuery).then((items) =>
              items.map((item) => ({
                id: item.id,
                title: item.processo_judicial || item.numero_ppe || "Representação sem número",
                subtitle: [item.tipo, item.status].filter(Boolean).join(" · "),
              })),
            );
      void request
        .then((items) => {
          if (!cancelled) setLinkResults(items);
        })
        .catch(() => {
          if (!cancelled) setLinkResults([]);
        })
        .finally(() => {
          if (!cancelled) setLinkLoading(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeLinkType, linkQuery, selectedInquerito, selectedRepresentacao]);

  const payload = useMemo<BoPayload>(
    () => ({
      numero_bo: numero.trim(),
      infracao_penal: infracao.trim(),
      diligencias_pendentes: diligencias.trim() || null,
      responsavel_nome: responsavel.trim() || null,
      observacao: observacao.trim() || null,
      status,
      inquerito_id: inqueritoId || null,
      representacao_id: representacaoId || null,
      local_categoria: localCategoria || null,
      local_logradouro: localLogradouro.trim() || null,
      local_numero: localNumero.trim() || null,
      local_bairro: localBairro.trim() || null,
      local_municipio: localMunicipio.trim() || null,
      local_uf: localUf.trim().toUpperCase() || null,
      local_ponto_referencia: localReferencia.trim() || null,
      local_link_navegacao: localLink.trim() || null,
    }),
    [
      diligencias,
      infracao,
      inqueritoId,
      localBairro,
      localCategoria,
      localLink,
      localLogradouro,
      localMunicipio,
      localNumero,
      localReferencia,
      localUf,
      numero,
      observacao,
      representacaoId,
      responsavel,
      status,
    ],
  );

  const chooseLinkType = (next: BoLinkType) => {
    if (next === "none") {
      setInqueritoId("");
      setRepresentacaoId("");
      setSelectedInquerito(null);
      setSelectedRepresentacao(null);
      setActiveLinkType(null);
    } else {
      setActiveLinkType(next);
    }
    setLinkQuery("");
    setLinkResults([]);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validateBoPayload(payload);
    if (validationError) return setError(validationError);
    setSaving(true);
    setError("");
    try {
      const saved = initial
        ? await updateBo(initial.id, payload, initial.updated_at)
        : await createBo(payload);
      navigate({ to: "/bo/$boId", params: { boId: saved.id } });
    } catch (cause) {
      setError(formatSaveError(cause));
    } finally {
      setSaving(false);
    }
  };

  if (!canManageBos(profile)) {
    return (
      <section className="bo-surface mx-auto max-w-xl rounded-2xl p-6 text-center">
        <h1 className="bo-title text-xl font-black">Edição não autorizada</h1>
        <p className="bo-muted mt-2 text-sm">
          Seu perfil pode consultar, mas não alterar boletins.
        </p>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-5xl">
      <header className="flex flex-col justify-between gap-4 border-b border-[var(--bo-border)] pb-5 sm:flex-row sm:items-end">
        <div>
          <Link
            to={initial ? "/bo/$boId" : "/bo/boletins"}
            params={initial ? { boId: initial.id } : ({} as never)}
            className="bo-muted inline-flex items-center gap-2 text-xs font-bold hover:text-[var(--bo-text)]"
          >
            <ChevronLeft className="h-4 w-4" /> Voltar
          </Link>
          <p className="bo-kicker mt-4 !text-violet-400">Cadastro operacional</p>
          <h1 className="bo-title mt-1 text-2xl font-black">
            {editing ? `Editar B.O. ${initial?.numero_bo}` : "Novo boletim de ocorrência"}
          </h1>
          <p className="bo-muted mt-1 text-sm">
            Os campos seguem o modelo usado atualmente na planilha da unidade.
          </p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="bo-primary-button inline-flex h-11 items-center justify-center gap-2 rounded-xl px-6 text-sm font-black disabled:opacity-60"
        >
          <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar B.O."}
        </button>
      </header>

      {error ? (
        <div className="mt-5 rounded-xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <section className="bo-surface mt-5 rounded-2xl p-5">
        <SectionTitle
          number="1"
          title="Identificação"
          description="Número, status e responsável."
        />
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Nº do B.O." required>
            <input
              value={numero}
              onChange={(event) => setNumero(event.target.value)}
              maxLength={120}
              placeholder="Ex.: 00573168/2026"
              className="bo-form-control"
            />
          </Field>
          <Field label="Status" required>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as BoStatus)}
              className="bo-form-control"
            >
              {BO_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Responsável pelo procedimento">
            <div className="relative">
              <input
                value={responsavel}
                onFocus={() => {
                  setResponsavelSuggestionsOpen(true);
                  setHighlightedResponsavel(0);
                }}
                onBlur={() => setResponsavelSuggestionsOpen(false)}
                onChange={(event) => {
                  setResponsavel(event.target.value);
                  setResponsavelSuggestionsOpen(true);
                  setHighlightedResponsavel(0);
                }}
                onKeyDown={(event) => {
                  if (!responsavelSuggestionsOpen || responsavelSuggestions.length === 0) return;
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setHighlightedResponsavel((current) =>
                      current >= responsavelSuggestions.length - 1 ? 0 : current + 1,
                    );
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setHighlightedResponsavel((current) =>
                      current <= 0 ? responsavelSuggestions.length - 1 : current - 1,
                    );
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    chooseResponsavelSuggestion(responsavelSuggestions[highlightedResponsavel]);
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    setResponsavelSuggestionsOpen(false);
                  }
                }}
                maxLength={300}
                placeholder="Nome do responsável"
                className="bo-form-control"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={responsavelSuggestionsOpen && responsavelSuggestions.length > 0}
                aria-controls="bo-responsavel-suggestions"
                autoComplete="off"
              />
              {responsavelSuggestionsOpen && responsavelSuggestions.length > 0 ? (
                <div
                  id="bo-responsavel-suggestions"
                  role="listbox"
                  className="bo-suggestion-results absolute inset-x-0 top-[calc(100%+0.35rem)] z-40 max-h-64 overflow-y-auto rounded-xl p-1.5"
                >
                  <p className="bo-faint px-3 py-2 text-[9px] font-black uppercase tracking-[0.14em]">
                    Servidores da unidade e responsáveis já registrados
                  </p>
                  {responsavelSuggestions.map((suggestion, index) => (
                    <button
                      key={suggestion}
                      type="button"
                      role="option"
                      aria-selected={index === highlightedResponsavel}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setHighlightedResponsavel(index)}
                      onClick={() => chooseResponsavelSuggestion(suggestion)}
                      className={`bo-suggestion-item flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs ${
                        index === highlightedResponsavel ? "bo-suggestion-item-active" : ""
                      }`}
                    >
                      <UserRound className="h-3.5 w-3.5 shrink-0 text-violet-400" />
                      <span className="bo-strong leading-5">{suggestion}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </Field>
        </div>
      </section>

      <section className="bo-surface mt-5 rounded-2xl p-5">
        <SectionTitle
          number="2"
          title="Informações operacionais"
          description="O que ocorreu e quais providências ainda estão pendentes."
        />
        <div className="mt-5 space-y-4">
          <Field label="Infração penal" required hint="Para várias infrações, use uma por linha.">
            <div className="relative">
              <textarea
                value={infracao}
                onFocus={() => {
                  if (getActiveBoInfractionQuery(infracao)) setInfracaoSuggestionsOpen(true);
                }}
                onBlur={() => setInfracaoSuggestionsOpen(false)}
                onChange={(event) => {
                  setInfracao(event.target.value);
                  setInfracaoSuggestionsOpen(
                    Boolean(getActiveBoInfractionQuery(event.target.value)),
                  );
                  setHighlightedSuggestion(0);
                }}
                onKeyDown={(event) => {
                  if (!infracaoSuggestionsOpen || infracaoSuggestions.length === 0) return;
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setHighlightedSuggestion((current) =>
                      current >= infracaoSuggestions.length - 1 ? 0 : current + 1,
                    );
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setHighlightedSuggestion((current) =>
                      current <= 0 ? infracaoSuggestions.length - 1 : current - 1,
                    );
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    chooseInfracaoSuggestion(infracaoSuggestions[highlightedSuggestion]);
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    setInfracaoSuggestionsOpen(false);
                  }
                }}
                maxLength={1000}
                rows={5}
                placeholder="Digite o código ou nome da infração..."
                className="bo-form-control resize-y"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={infracaoSuggestionsOpen && infracaoSuggestions.length > 0}
                aria-controls="bo-infracao-suggestions"
                autoComplete="off"
              />
              {infracaoSuggestionsOpen && infracaoSuggestions.length > 0 ? (
                <div
                  id="bo-infracao-suggestions"
                  role="listbox"
                  className="bo-suggestion-results absolute inset-x-0 top-[calc(100%+0.35rem)] z-40 max-h-64 overflow-y-auto rounded-xl p-1.5"
                >
                  <p className="bo-faint px-3 py-2 text-[9px] font-black uppercase tracking-[0.14em]">
                    Sugestões do catálogo dos Inquéritos
                  </p>
                  {infracaoSuggestions.map((suggestion, index) => (
                    <button
                      key={suggestion}
                      type="button"
                      role="option"
                      aria-selected={index === highlightedSuggestion}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setHighlightedSuggestion(index)}
                      onClick={() => chooseInfracaoSuggestion(suggestion)}
                      className={`bo-suggestion-item flex w-full items-start gap-2 rounded-lg px-3 py-2.5 text-left text-xs ${
                        index === highlightedSuggestion ? "bo-suggestion-item-active" : ""
                      }`}
                    >
                      <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-400" />
                      <span className="bo-strong leading-5">{suggestion}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </Field>
          <Field
            label="Diligências pendentes"
            hint="Digite ao menos 2 letras. Os modelos são gerais: adapte ao caso e use uma diligência por linha."
          >
            <div className="relative">
              <textarea
                value={diligencias}
                onFocus={() => {
                  if (getActiveBoDiligenceQuery(diligencias).length >= 2) {
                    setDiligenciaSuggestionsOpen(true);
                  }
                }}
                onBlur={() => setDiligenciaSuggestionsOpen(false)}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setDiligencias(nextValue);
                  setDiligenciaSuggestionsOpen(getActiveBoDiligenceQuery(nextValue).length >= 2);
                  setHighlightedDiligenciaSuggestion(0);
                }}
                onKeyDown={(event) => {
                  if (!diligenciaSuggestionsOpen || diligenciaSuggestions.length === 0) return;
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setHighlightedDiligenciaSuggestion((current) =>
                      current >= diligenciaSuggestions.length - 1 ? 0 : current + 1,
                    );
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setHighlightedDiligenciaSuggestion((current) =>
                      current <= 0 ? diligenciaSuggestions.length - 1 : current - 1,
                    );
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    chooseDiligenciaSuggestion(
                      diligenciaSuggestions[highlightedDiligenciaSuggestion],
                    );
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    setDiligenciaSuggestionsOpen(false);
                  }
                }}
                maxLength={5000}
                rows={4}
                placeholder="Comece a digitar: intimar, laudo, aguardar, ofício..."
                className="bo-form-control resize-y"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={diligenciaSuggestionsOpen && diligenciaSuggestions.length > 0}
                aria-controls="bo-diligencia-suggestions"
                autoComplete="off"
              />
              {diligenciaSuggestionsOpen && diligenciaSuggestions.length > 0 ? (
                <div
                  id="bo-diligencia-suggestions"
                  role="listbox"
                  className="bo-suggestion-results absolute inset-x-0 top-[calc(100%+0.35rem)] z-40 max-h-72 overflow-y-auto rounded-xl p-1.5"
                >
                  <div className="flex items-center justify-between gap-3 px-3 py-2">
                    <p className="bo-faint text-[9px] font-black uppercase tracking-[0.14em]">
                      Modelos de diligências
                    </p>
                    <span className="bo-faint text-[9px]">
                      ↑ ↓ selecionar · Enter inserir · Esc fechar
                    </span>
                  </div>
                  {diligenciaSuggestions.map((suggestion, index) => (
                    <button
                      key={suggestion}
                      type="button"
                      role="option"
                      aria-selected={index === highlightedDiligenciaSuggestion}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setHighlightedDiligenciaSuggestion(index)}
                      onClick={() => chooseDiligenciaSuggestion(suggestion)}
                      className={`bo-suggestion-item flex w-full items-start gap-2 rounded-lg px-3 py-2.5 text-left text-xs ${
                        index === highlightedDiligenciaSuggestion ? "bo-suggestion-item-active" : ""
                      }`}
                    >
                      <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-400" />
                      <span className="bo-strong leading-5">{suggestion}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </Field>
          <Field label="Observação">
            <textarea
              value={observacao}
              onChange={(event) => setObservacao(event.target.value)}
              maxLength={5000}
              rows={4}
              placeholder="Informações complementares, se necessárias."
              className="bo-form-control resize-y"
            />
          </Field>
        </div>
      </section>

      <section className="bo-surface mt-5 rounded-2xl p-5">
        <SectionTitle
          number="3"
          title="Local do fato"
          description="Endereço e classificação operacional usados também nas análises do NEXO."
        />
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Categoria do local">
            <select
              value={localCategoria}
              onChange={(event) => setLocalCategoria(event.target.value as BoLocationCategory | "")}
              className="bo-form-control"
            >
              <option value="">Não classificado</option>
              <option value="area_influencia">Área de influência</option>
              <option value="ponto_venda">Ponto de venda</option>
              <option value="ponto_encontro">Ponto de encontro</option>
              <option value="esconderijo">Esconderijo</option>
              <option value="deposito">Depósito</option>
              <option value="rota_operacional">Rota operacional</option>
              <option value="outro">Outro</option>
            </select>
          </Field>
          <Field label="Logradouro">
            <input
              value={localLogradouro}
              onChange={(event) => setLocalLogradouro(event.target.value)}
              className="bo-form-control"
              placeholder="Rua, avenida ou estrada"
            />
          </Field>
          <Field label="Número">
            <input
              value={localNumero}
              onChange={(event) => setLocalNumero(event.target.value)}
              className="bo-form-control"
              placeholder="S/N"
            />
          </Field>
          <Field label="Bairro / localidade">
            <input
              value={localBairro}
              onChange={(event) => setLocalBairro(event.target.value)}
              className="bo-form-control"
            />
          </Field>
          <Field label="Município">
            <input
              value={localMunicipio}
              onChange={(event) => setLocalMunicipio(event.target.value)}
              className="bo-form-control"
            />
          </Field>
          <Field label="UF">
            <input
              value={localUf}
              onChange={(event) => setLocalUf(event.target.value.toUpperCase())}
              maxLength={2}
              className="bo-form-control"
            />
          </Field>
          <Field label="Ponto de referência">
            <input
              value={localReferencia}
              onChange={(event) => setLocalReferencia(event.target.value)}
              className="bo-form-control"
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="Link Google Maps / navegação">
              <div className="relative">
                <MapPin className="absolute left-3 top-3.5 h-4 w-4 text-violet-400" />
                <input
                  type="url"
                  value={localLink}
                  onChange={(event) => setLocalLink(event.target.value)}
                  className="bo-form-control pl-10"
                  placeholder="https://maps.google.com/..."
                />
              </div>
            </Field>
          </div>
        </div>
      </section>

      <section className="bo-surface mt-5 rounded-2xl p-5">
        <SectionTitle
          number="4"
          title="Vínculo com outro procedimento"
          description="Opcional. O mesmo B.O. pode ser vinculado a um Inquérito e a uma Representação."
        />
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <LinkTypeButton
            active={!inqueritoId && !representacaoId && !activeLinkType}
            icon={Unlink}
            label="Sem vínculo"
            onClick={() => chooseLinkType("none")}
          />
          <LinkTypeButton
            active={Boolean(inqueritoId) || activeLinkType === "inquerito"}
            icon={FileText}
            label="Vincular a Inquérito"
            onClick={() => chooseLinkType("inquerito")}
          />
          <LinkTypeButton
            active={Boolean(representacaoId) || activeLinkType === "representacao"}
            icon={Scale}
            label="Vincular a Representação"
            onClick={() => chooseLinkType("representacao")}
          />
        </div>

        {selectedInquerito || selectedRepresentacao ? (
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {selectedInquerito ? (
              <SelectedLinkCard
                label="Inquérito vinculado"
                title={selectedInquerito.title}
                subtitle={selectedInquerito.subtitle}
                icon={FileText}
                onRemove={() => {
                  setInqueritoId("");
                  setSelectedInquerito(null);
                  setActiveLinkType(null);
                  setLinkQuery("");
                }}
              />
            ) : null}
            {selectedRepresentacao ? (
              <SelectedLinkCard
                label="Representação vinculada"
                title={selectedRepresentacao.title}
                subtitle={selectedRepresentacao.subtitle}
                icon={Scale}
                onRemove={() => {
                  setRepresentacaoId("");
                  setSelectedRepresentacao(null);
                  setActiveLinkType(null);
                  setLinkQuery("");
                }}
              />
            ) : null}
          </div>
        ) : null}

        {activeLinkType &&
        !(activeLinkType === "inquerito" ? selectedInquerito : selectedRepresentacao) ? (
          <div className="relative mt-4">
            <label className="bo-control flex h-11 items-center gap-2 rounded-xl px-4">
              <Search className="bo-faint h-4 w-4" />
              <input
                value={linkQuery}
                onChange={(event) => setLinkQuery(event.target.value)}
                placeholder={
                  activeLinkType === "inquerito"
                    ? "Digite parte do número PPE..."
                    : "Digite PPE, processo ou tipo da representação..."
                }
                className="min-w-0 flex-1 bg-transparent text-xs outline-none"
              />
            </label>
            {linkQuery.trim().length >= 2 ? (
              <div className="bo-link-results mt-2 overflow-hidden rounded-xl border border-[var(--bo-border)]">
                {linkLoading ? (
                  <p className="bo-muted p-4 text-xs">Buscando vínculos...</p>
                ) : linkResults.length === 0 ? (
                  <p className="bo-muted p-4 text-xs">Nenhum registro encontrado.</p>
                ) : (
                  linkResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (activeLinkType === "inquerito") {
                          setInqueritoId(item.id);
                          setSelectedInquerito(item);
                        } else {
                          setRepresentacaoId(item.id);
                          setSelectedRepresentacao(item);
                        }
                        setActiveLinkType(null);
                        setLinkQuery("");
                        setLinkResults([]);
                      }}
                      className="bo-row flex w-full items-center gap-3 px-4 py-3 text-left"
                    >
                      <Link2 className="h-4 w-4 shrink-0 text-violet-400" />
                      <span className="min-w-0">
                        <strong className="bo-strong block text-xs">{item.title}</strong>
                        <small className="bo-muted block truncate text-[10px]">
                          {item.subtitle}
                        </small>
                      </span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <div className="mt-5 flex justify-end gap-3">
        <Link
          to={initial ? "/bo/$boId" : "/bo/boletins"}
          params={initial ? { boId: initial.id } : ({} as never)}
          className="bo-control inline-flex h-11 items-center rounded-xl px-5 text-sm font-bold"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={saving}
          className="bo-primary-button inline-flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-black disabled:opacity-60"
        >
          <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar B.O."}
        </button>
      </div>
    </form>
  );
}

function SectionTitle({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-[var(--bo-border)] pb-4">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-violet-500/12 text-xs font-black text-violet-400">
        {number}
      </span>
      <div>
        <h2 className="bo-section-title text-sm font-black">{title}</h2>
        <p className="bo-muted mt-1 text-xs">{description}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="bo-strong mb-2 block text-xs font-black">
        {label} {required ? <em className="not-italic text-red-400">*</em> : null}
      </span>
      {children}
      {hint ? <small className="bo-faint mt-1.5 block text-[10px]">{hint}</small> : null}
    </label>
  );
}

function LinkTypeButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Unlink;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`bo-flat-surface flex items-center gap-3 rounded-xl p-4 text-left transition ${
        active ? "!border-violet-400/55 !bg-violet-500/12" : ""
      }`}
    >
      <Icon className={`h-4 w-4 ${active ? "text-violet-400" : "bo-faint"}`} />
      <span className="bo-strong text-xs font-black">{label}</span>
    </button>
  );
}

function SelectedLinkCard({
  label,
  title,
  subtitle,
  icon: Icon,
  onRemove,
}: {
  label: string;
  title: string;
  subtitle: string;
  icon: typeof FileText;
  onRemove: () => void;
}) {
  return (
    <div className="bo-flat-surface flex items-center gap-3 rounded-xl p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <small className="bo-faint block text-[9px] font-black uppercase tracking-[0.12em]">
          {label}
        </small>
        <strong className="bo-strong mt-1 block truncate text-sm">{title}</strong>
        <small className="bo-muted block truncate text-xs">{subtitle}</small>
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="bo-muted text-xs font-bold hover:text-red-400"
      >
        Remover
      </button>
    </div>
  );
}

function formatSaveError(cause: unknown) {
  const source = cause as { code?: string; message?: string };
  if (source?.code === "23505") return "Já existe um B.O. ativo com esse número.";
  if (source?.code === "23514") return "Revise o status e o vínculo selecionados.";
  return source?.message || "Não foi possível salvar o B.O.";
}
