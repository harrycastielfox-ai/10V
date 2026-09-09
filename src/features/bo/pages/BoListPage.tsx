import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  ClipboardList,
  FileText,
  Plus,
  Scale,
  Search,
  Unlink,
} from "lucide-react";
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
import { getBoStatusTone, normalizeBoText, type BoRecord } from "../boTypes";

const STATUS_ACCENT: Record<string, string> = {
  amber: "#f59e0b",
  blue: "#3b82f6",
  cyan: "#06b6d4",
  purple: "#8b5cf6",
  green: "#22c55e",
  red: "#ef4444",
  slate: "#94a3b8",
};

function statusAccentColor(status: string | null | undefined) {
  return STATUS_ACCENT[getBoStatusTone(status)] ?? STATUS_ACCENT.slate;
}

export default function BoListPage() {
  const profile = useAppProfile();
  const navigate = useNavigate();
  const canManage = canManageBos(profile);
  const [records, setRecords] = useState<BoRecord[]>([]);
  const [inqueritos, setInqueritos] = useState<InqueritoRecord[]>([]);
  const [representacoes, setRepresentacoes] = useState<RepresentacaoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
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

  const inqueritoById = useMemo(() => new Map(inqueritos.map((item) => [item.id, item])), [
    inqueritos,
  ]);
  const representacaoById = useMemo(
    () => new Map(representacoes.map((item) => [item.id, item])),
    [representacoes],
  );

  const linkOf = (record: BoRecord): BoQuickPreviewLink => {
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
  };

  const filtered = useMemo(() => {
    const term = normalizeBoText(query);
    if (!term) return records;
    return records.filter((record) => {
      const link = linkOf(record);
      return normalizeBoText([record.numero_bo, link.label].join(" ")).includes(term);
    });
  }, [query, records, inqueritoById, representacaoById]);

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
    <div>
      <header className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-purple">
            Operação
          </p>
          <h1 className="mt-1 text-2xl font-black text-foreground">Boletins de Ocorrência</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Clique em um boletim para ver o resumo, imprimir, editar ou excluir.
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

      <section className="mt-5 rounded-2xl border border-border bg-card p-4">
        <label className="flex h-11 items-center gap-2 rounded-xl border border-border bg-background px-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por número do B.O. ou procedimento vinculado..."
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
      </section>

      <section className="mt-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl border border-purple/25 bg-purple/10 text-purple">
              <ClipboardList className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-black text-foreground">Registros encontrados</h2>
              <p className="text-[10px] text-muted-foreground">
                {loading ? "Carregando..." : `${filtered.length} de ${records.length} boletins`}
              </p>
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-destructive/25 bg-destructive/10 py-12 text-center text-sm text-destructive">
            {error}
          </div>
        ) : loading ? (
          <div className="rounded-2xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">
            Carregando boletins...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">
            Nenhum boletim corresponde à busca informada.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((record) => {
              const link = linkOf(record);
              return (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => setSelectedId(record.id)}
                  className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-purple/40 hover:shadow-lg"
                >
                  <span
                    className="absolute inset-y-0 left-0 w-1"
                    style={{ backgroundColor: statusAccentColor(record.status) }}
                    aria-hidden="true"
                  />
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-purple/25 bg-purple/10 text-purple">
                    <ClipboardList className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                      Nº do B.O.
                    </p>
                    <p className="mt-0.5 truncate text-lg font-black text-foreground">
                      {record.numero_bo}
                    </p>
                    <LinkBadge link={link} />
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
                </button>
              );
            })}
          </div>
        )}
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
        onPrint={() => {
          if (!selected) return;
          setSelectedId(null);
          navigate({
            to: "/bo/$boId",
            params: { boId: selected.id },
            search: { print: "1" } as never,
          });
        }}
        onEdit={() => {
          if (!selected) return;
          setSelectedId(null);
          navigate({ to: "/bo/$boId/editar", params: { boId: selected.id } });
        }}
        onDelete={removeRecord}
      />
    </div>
  );
}

function LinkBadge({ link }: { link: BoQuickPreviewLink }) {
  const Icon = link.type === "representacao" ? Scale : link.type === "inquerito" ? FileText : Unlink;
  const toneClass =
    link.type === "inquerito"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-500"
      : link.type === "representacao"
        ? "border-violet-400/30 bg-violet-500/10 text-violet-500"
        : "border-border bg-muted text-muted-foreground";
  return (
    <span
      className={`mt-2 inline-flex max-w-full items-center gap-1.5 truncate rounded-full border px-2.5 py-1 text-[10px] font-bold ${toneClass}`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate">{link.label}</span>
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
