import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, FileText, Plus, Scale, Search, Unlink } from "lucide-react";
import { BoQuickPreview, type BoQuickPreviewLink } from "@/components/RecordQuickPreview";
import { useAppProfile } from "@/components/AppProfileContext";
import { canManageBos } from "@/lib/authz";
import { getErrorCode, getErrorMessage } from "@/lib/errorMessage";
import { listBos, softDeleteBo } from "@/lib/repositories/boRepository";
import { listInqueritos, type InqueritoRecord } from "@/lib/repositories/inqueritosRepository";
import {
  listRepresentacoes,
  type RepresentacaoRecord,
} from "@/lib/repositories/representacoesRepository";
import { getBoStatusLabel, getBoStatusTone, normalizeBoText, type BoRecord } from "../boTypes";

export default function BoListPage() {
  const profile = useAppProfile();
  const navigate = useNavigate();
  const search = useSearch({ from: "/bo/boletins" });
  const canManage = canManageBos(profile);
  const [records, setRecords] = useState<BoRecord[]>([]);
  const [inqueritos, setInqueritos] = useState<InqueritoRecord[]>([]);
  const [representacoes, setRepresentacoes] = useState<RepresentacaoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState(search.q ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      listBos(),
      listInqueritos().catch(() => [] as InqueritoRecord[]),
      listRepresentacoes().catch(() => [] as RepresentacaoRecord[]),
    ])
      .then(([bos, casos, movimentacoes]) => {
        setRecords(bos);
        setInqueritos(casos);
        setRepresentacoes(movimentacoes);
      })
      .catch((cause) => setError(getErrorMessage(cause, "Não foi possível carregar os boletins.")))
      .finally(() => setLoading(false));
  }, []);

  const inqueritoById = useMemo(
    () => new Map(inqueritos.map((item) => [item.id, item])),
    [inqueritos],
  );
  const representacaoById = useMemo(
    () => new Map(representacoes.map((item) => [item.id, item])),
    [representacoes],
  );

  const linkOf = useCallback(
    (record: BoRecord): BoQuickPreviewLink => {
      if (record.inquerito_id) {
        const inquerito = inqueritoById.get(record.inquerito_id);
        return {
          type: "inquerito",
          label: inquerito?.numero_ppe?.trim() || "Inquérito sem número",
        };
      }
      if (record.representacao_id) {
        const representacao = representacaoById.get(record.representacao_id);
        return {
          type: "representacao",
          label:
            representacao?.processo_judicial?.trim() ||
            representacao?.numero_ppe?.trim() ||
            "Representação sem número",
        };
      }
      return { type: "none", label: "Sem vínculo" };
    },
    [inqueritoById, representacaoById],
  );

  const filtered = useMemo(() => {
    const term = normalizeBoText(query);
    if (!term) return records;
    return records.filter((record) => {
      const link = linkOf(record);
      return normalizeBoText(
        [
          record.numero_bo,
          record.infracao_penal,
          record.responsavel_nome,
          record.status,
          record.diligencias_pendentes,
          link.label,
        ].join(" "),
      ).includes(term);
    });
  }, [query, records, linkOf]);

  const selected = useMemo(
    () => records.find((record) => record.id === selectedId) ?? null,
    [records, selectedId],
  );

  const removeRecord = async () => {
    if (!selected) return;
    if (!window.confirm(`Excluir o B.O. ${selected.numero_bo}? O evento ficará na auditoria.`)) {
      return;
    }
    setDeletingId(selected.id);
    try {
      await softDeleteBo(selected.id);
      setRecords((current) => current.filter((item) => item.id !== selected.id));
      setSelectedId(null);
    } catch (cause) {
      window.alert(getBoDeleteError(cause));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/60 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.015)] sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-black tracking-tight text-foreground lg:text-3xl">
            Boletins de Ocorrência
          </h1>
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Carregando boletins..."
              : `${filtered.length} de ${records.length} boletim(ns) encontrado(s)`}
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={() => navigate({ to: "/bo/novo" })}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-purple px-5 text-sm font-black text-white transition hover:brightness-110"
          >
            <Plus className="h-4 w-4" /> Novo boletim
          </button>
        ) : null}
      </header>

      <section className="rounded-2xl border border-border/80 bg-card/70 p-4 md:p-5">
        <label className="flex h-12 items-center gap-3 rounded-xl border border-border bg-background/70 px-4 transition focus-within:border-purple/55 focus-within:ring-4 focus-within:ring-purple/10">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por número do B.O. ou procedimento vinculado..."
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
      </section>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <section className="overflow-x-auto rounded-2xl border border-border/80 bg-card/90 shadow-[0_10px_40px_rgba(0,0,0,0.14)]">
        <table className="w-full table-fixed text-sm" style={{ minWidth: 1040 }}>
          <thead className="bg-muted/25 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <tr>
              <th className="w-[16%] px-4 py-3 text-left font-bold">Nº do B.O.</th>
              <th className="w-[23%] px-3 py-3 text-left font-bold">Infração penal</th>
              <th className="w-[15%] px-3 py-3 text-left font-bold">Responsável</th>
              <th className="w-[13%] px-3 py-3 text-center font-bold">Status</th>
              <th className="w-[18%] px-3 py-3 text-left font-bold">Procedimento vinculado</th>
              <th className="w-[11%] px-3 py-3 text-center font-bold">Pendências</th>
              <th className="w-[4%] px-3 py-3 text-center font-bold" aria-label="Ação" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="border-t border-border/70">
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  Carregando boletins...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr className="border-t border-border/70">
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  Nenhum boletim corresponde à busca informada.
                </td>
              </tr>
            ) : (
              filtered.map((record) => {
                const link = linkOf(record);
                const hasPendingAction = Boolean(record.diligencias_pendentes?.trim());
                return (
                  <tr
                    key={record.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Visualizar resumo do B.O. ${record.numero_bo}`}
                    onClick={() => setSelectedId(record.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedId(record.id);
                      }
                    }}
                    className="cursor-pointer border-t border-border/70 transition hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple/60"
                  >
                    <td className="px-4 py-3.5 align-middle">
                      <span
                        className="block truncate font-mono text-[14px] font-bold text-purple"
                        title={record.numero_bo}
                      >
                        {record.numero_bo}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 align-middle">
                      <span
                        className="block truncate text-[13px] font-semibold text-foreground/95"
                        title={record.infracao_penal}
                      >
                        {record.infracao_penal}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 align-middle">
                      <span
                        className="block truncate text-xs text-muted-foreground"
                        title={record.responsavel_nome || "Não informado"}
                      >
                        {record.responsavel_nome || "Não informado"}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-center align-middle">
                      <BoListStatus status={record.status} />
                    </td>
                    <td className="px-3 py-3.5 align-middle">
                      <LinkBadge link={link} />
                    </td>
                    <td className="px-3 py-3.5 text-center align-middle">
                      <span
                        className={`inline-flex min-h-6 items-center justify-center rounded border px-2 py-0.5 text-[10px] font-extrabold uppercase leading-none tracking-wide ${
                          hasPendingAction
                            ? "border-amber-400/35 bg-amber-500/10 text-amber-500"
                            : "border-border bg-muted/60 text-muted-foreground"
                        }`}
                      >
                        {hasPendingAction ? "Pendente" : "Nenhuma"}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-center align-middle">
                      <ChevronRight className="mx-auto h-4 w-4 text-muted-foreground" />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      <BoQuickPreview
        record={selected}
        link={selected ? linkOf(selected) : { type: "none", label: "Sem vínculo" }}
        canManage={canManage}
        deleting={deletingId === selectedId}
        onClose={() => setSelectedId(null)}
        onOpenFull={() => {
          if (!selected) return;
          setSelectedId(null);
          navigate({ to: "/bo/$boId", params: { boId: selected.id } });
        }}
        onDelete={removeRecord}
      />
    </div>
  );
}

function LinkBadge({ link }: { link: BoQuickPreviewLink }) {
  const Icon =
    link.type === "representacao" ? Scale : link.type === "inquerito" ? FileText : Unlink;
  const toneClass =
    link.type === "inquerito"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-500"
      : link.type === "representacao"
        ? "border-violet-400/30 bg-violet-500/10 text-violet-500"
        : "border-border bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 truncate rounded-full border px-2.5 py-1 text-[10px] font-bold ${toneClass}`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate">{link.label}</span>
    </span>
  );
}

function BoListStatus({ status }: { status: BoRecord["status"] }) {
  const tone = getBoStatusTone(status);
  const toneClass =
    tone === "green"
      ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-500"
      : tone === "blue" || tone === "cyan"
        ? "border-blue-400/35 bg-blue-500/10 text-blue-500"
        : tone === "amber"
          ? "border-amber-400/35 bg-amber-500/10 text-amber-500"
          : tone === "red"
            ? "border-red-400/35 bg-red-500/10 text-red-500"
            : tone === "purple"
              ? "border-purple/35 bg-purple/10 text-purple"
              : "border-border bg-muted/60 text-muted-foreground";
  return (
    <span
      className={`inline-flex min-h-6 max-w-full items-center justify-center rounded border px-2 py-0.5 text-[10px] font-extrabold uppercase leading-none tracking-wide ${toneClass}`}
      title={getBoStatusLabel(status)}
    >
      <span className="truncate">{getBoStatusLabel(status)}</span>
    </span>
  );
}

function getBoDeleteError(cause: unknown) {
  const code = getErrorCode(cause);
  const message = getErrorMessage(cause, "Não foi possível excluir o B.O.");
  if (code === "42501" || message.includes("bo_permission_denied")) {
    return "Seu perfil não tem permissão para excluir este B.O.";
  }
  if (message.toLowerCase().includes("row-level security")) {
    return "A exclusão foi bloqueada pela segurança do banco. Atualize a página e tente novamente.";
  }
  return message;
}
