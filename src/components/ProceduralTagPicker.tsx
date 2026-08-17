import { Plus, Search, Tag, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  getProceduralTagSearchRank,
  matchesProceduralTagQuery,
  normalizeProceduralTagSearch,
  TAG_COLOR_CLASS,
  type ProceduralTag,
  type ProceduralTagColor,
  type ProceduralTagScope,
} from "@/lib/proceduralTags";
import { parseTipificacoes } from "@/lib/tipificacaoParser";

type ProceduralTagPickerProps = {
  label: string;
  options: ProceduralTag[];
  value: string[];
  onChange: (tagIds: string[]) => void;
  onCreate?: (input: {
    scope: ProceduralTagScope;
    name: string;
    color: ProceduralTagColor;
  }) => Promise<ProceduralTag>;
  createScope?: ProceduralTagScope;
  canCreate?: boolean;
  hint?: string;
  placeholder?: string;
};

export function ProceduralTagPicker({
  label,
  options,
  value,
  onChange,
  onCreate,
  createScope,
  canCreate = false,
  hint,
  placeholder = "Digite um número ou palavra para buscar",
}: ProceduralTagPickerProps) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () =>
      value
        .map((id) => options.find((option) => option.id === id))
        .filter(Boolean) as ProceduralTag[],
    [options, value],
  );
  const available = useMemo(() => {
    const normalized = query.trim();
    return options
      .filter(
        (option) =>
          !value.includes(option.id) &&
          (!normalized || matchesProceduralTagQuery(option.name, normalized)),
      )
      .sort((left, right) => {
        const rankDifference =
          getProceduralTagSearchRank(left.name, normalized) -
          getProceduralTagSearchRank(right.name, normalized);
        return rankDifference || left.name.localeCompare(right.name, "pt-BR");
      });
  }, [options, query, value]);
  const hasExactMatch = useMemo(() => {
    const normalized = normalizeProceduralTagSearch(query);
    return Boolean(
      normalized &&
      options.some((option) => normalizeProceduralTagSearch(option.name) === normalized),
    );
  }, [options, query]);

  function selectTag(tag: ProceduralTag) {
    onChange([...new Set([...value, tag.id])]);
    setQuery("");
    setError("");
    setOpen(false);
  }

  async function handleCreate() {
    if (!onCreate || !createScope || !query.trim() || creating) return;
    setCreating(true);
    setError("");
    try {
      const names = parseTipificacoes(
        query,
        options.filter((option) => option.scope === createScope).map((option) => option.name),
      ).map((item) => item.rotulo);
      const createdIds: string[] = [];
      for (const name of names) {
        const created = await onCreate({ scope: createScope, name, color: "purple" });
        createdIds.push(created.id);
      }
      onChange([...new Set([...value, ...createdIds])]);
      setQuery("");
      setOpen(false);
    } catch (createError) {
      console.error("[procedural-tags:create]", createError);
      setError("Não foi possível criar esta tag. Verifique seu perfil e tente novamente.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-2 md:col-span-2 lg:col-span-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((tag) => (
            <span
              key={tag.id}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold ${TAG_COLOR_CLASS[tag.color]}`}
            >
              <Tag className="h-3 w-3" aria-hidden="true" />
              {tag.name}
              <button
                type="button"
                onClick={() => onChange(value.filter((id) => id !== tag.id))}
                className="ml-0.5 rounded p-0.5 opacity-70 transition hover:bg-white/10 hover:opacity-100"
                aria-label={`Remover tag ${tag.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* O campo repete a aparência dos demais do formulário (mesma altura,
          fundo e borda) para não parecer apagado no meio dos outros. */}
      <div
        className="relative"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
        }}
      >
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              className="sipi-search-neon pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary"
              aria-hidden="true"
            />
            <input
              value={query}
              onFocus={() => setOpen(true)}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                if (open && available.length > 0) {
                  event.preventDefault();
                  selectTag(available[0]);
                } else if (canCreate && onCreate && createScope && query.trim()) {
                  event.preventDefault();
                  void handleCreate();
                }
              }}
              placeholder={placeholder}
              className="h-11 w-full rounded-lg border border-border bg-card pl-10 pr-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary"
              role="combobox"
              aria-expanded={open}
              aria-controls="procedural-tag-results"
              autoComplete="off"
            />
          </div>
          {canCreate && onCreate && createScope && query.trim() && !hasExactMatch && (
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-primary/50 bg-primary/15 px-3.5 text-xs font-semibold text-primary transition hover:bg-primary/25 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              {creating ? "Criando..." : "Criar tag"}
            </button>
          )}
        </div>
        {open && (
          <div
            id="procedural-tag-results"
            role="listbox"
            className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-40 max-h-64 overflow-y-auto rounded-lg border border-primary/35 bg-card p-1.5 shadow-2xl"
          >
            {available.map((tag) => (
              <button
                key={tag.id}
                type="button"
                role="option"
                aria-selected="false"
                onClick={() => selectTag(tag)}
                className="flex w-full items-start gap-2 rounded-md border border-transparent px-3 py-2 text-left text-xs font-medium text-foreground transition hover:border-primary/25 hover:bg-primary/10"
              >
                <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="leading-5">{tag.name}</span>
              </button>
            ))}
            {available.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                Nenhuma outra tag disponível.
              </p>
            ) : null}
          </div>
        )}
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}

export function ProceduralStatusSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ProceduralTag[];
  value: string;
  onChange: (id: string) => void;
}) {
  const selected = options.find((option) => option.id === value);
  return (
    <label className="space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:border-primary/55"
      >
        <option value="">Selecione o status</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      {selected && (
        <span
          className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TAG_COLOR_CLASS[selected.color]}`}
        >
          {selected.name}
        </span>
      )}
    </label>
  );
}
