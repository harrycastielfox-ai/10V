import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, ClipboardList, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { useAppProfile } from "@/components/AppProfileContext";
import { canManageBos } from "@/lib/authz";
import { getErrorMessage } from "@/lib/errorMessage";
import { listBos } from "@/lib/repositories/boRepository";
import { BO_STATUS_OPTIONS, normalizeBoText, type BoRecord } from "../boTypes";
import { BoStatusBadge } from "../components/BoStatusBadge";

export default function BoListPage() {
  const profile = useAppProfile();
  const [records, setRecords] = useState<BoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [responsavel, setResponsavel] = useState("");

  useEffect(() => {
    void listBos()
      .then(setRecords)
      .catch((cause) => setError(getErrorMessage(cause, "Não foi possível carregar os boletins.")))
      .finally(() => setLoading(false));
  }, []);

  const responsaveis = useMemo(
    () =>
      [
        ...new Set(
          records.map((record) => record.responsavel_nome?.trim()).filter(Boolean) as string[],
        ),
      ].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [records],
  );

  const filtered = useMemo(() => {
    const term = normalizeBoText(query);
    return records.filter((record) => {
      if (status && record.status !== status) return false;
      if (responsavel && record.responsavel_nome !== responsavel) return false;
      if (!term) return true;
      return normalizeBoText(
        [
          record.numero_bo,
          record.infracao_penal,
          record.diligencias_pendentes,
          record.responsavel_nome,
          record.observacao,
        ].join(" "),
      ).includes(term);
    });
  }, [query, records, responsavel, status]);

  const clearFilters = () => {
    setQuery("");
    setStatus("");
    setResponsavel("");
  };

  return (
    <div>
      <header className="flex flex-col justify-between gap-4 border-b border-[var(--bo-border)] pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="bo-kicker !text-violet-400">Operação</p>
          <h1 className="bo-title mt-1 text-2xl font-black">Boletins de Ocorrência</h1>
          <p className="bo-muted mt-1 text-sm">
            Consulte, filtre e abra cada registro para visualizar os detalhes.
          </p>
        </div>
        {canManageBos(profile) ? (
          <Link
            to="/bo/novo"
            className="bo-primary-button inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-black"
          >
            <Plus className="h-4 w-4" /> Novo boletim
          </Link>
        ) : null}
      </header>

      <section className="bo-surface mt-5 rounded-2xl p-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_230px_230px_auto]">
          <label className="bo-control flex h-11 items-center gap-2 rounded-xl px-4">
            <Search className="bo-faint h-4 w-4" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nº, infração, diligência ou responsável..."
              className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--bo-faint)]"
            />
          </label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="bo-control h-11 rounded-xl px-4 text-xs outline-none"
            aria-label="Filtrar por status"
          >
            <option value="">Todos os status</option>
            {BO_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={responsavel}
            onChange={(event) => setResponsavel(event.target.value)}
            className="bo-control h-11 rounded-xl px-4 text-xs outline-none"
            aria-label="Filtrar por responsável"
          >
            <option value="">Todos os responsáveis</option>
            {responsaveis.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={clearFilters}
            className="bo-control inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold"
          >
            <X className="h-4 w-4" /> Limpar
          </button>
        </div>
      </section>

      <section className="bo-surface mt-5 overflow-hidden rounded-2xl p-4">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--bo-border)] pb-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
              <ClipboardList className="h-4 w-4" />
            </span>
            <div>
              <h2 className="bo-section-title text-sm font-black">Registros encontrados</h2>
              <p className="bo-faint text-[10px]">
                {loading ? "Carregando..." : `${filtered.length} de ${records.length} boletins`}
              </p>
            </div>
          </div>
          <SlidersHorizontal className="bo-faint h-4 w-4" />
        </div>

        {error ? (
          <div className="py-12 text-center text-sm text-red-400">{error}</div>
        ) : loading ? (
          <div className="bo-muted py-12 text-center text-sm">Carregando boletins...</div>
        ) : filtered.length === 0 ? (
          <div className="bo-muted py-12 text-center text-sm">
            Nenhum boletim corresponde aos filtros informados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[820px]">
              <div className="bo-table-head grid grid-cols-[1.05fr_2.2fr_1.2fr_1.25fr_1.1fr_auto] gap-4 px-3 py-3">
                <span>Nº do B.O.</span>
                <span>Infração penal</span>
                <span>Responsável</span>
                <span>Diligências</span>
                <span>Status</span>
                <span />
              </div>
              {filtered.map((record) => (
                <Link
                  key={record.id}
                  to="/bo/$boId"
                  params={{ boId: record.id }}
                  className="bo-row grid grid-cols-[1.05fr_2.2fr_1.2fr_1.25fr_1.1fr_auto] items-center gap-4 px-3 py-3"
                >
                  <strong className="bo-strong text-sm font-black">{record.numero_bo}</strong>
                  <span className="bo-muted line-clamp-2 text-xs">{record.infracao_penal}</span>
                  <span className="bo-muted truncate text-xs">
                    {record.responsavel_nome || "Não informado"}
                  </span>
                  <span className="bo-muted truncate text-xs">
                    {record.diligencias_pendentes || "Nenhuma informada"}
                  </span>
                  <BoStatusBadge status={record.status} />
                  <ChevronRight className="bo-faint h-4 w-4" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
