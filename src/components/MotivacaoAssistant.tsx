import { Check, Lightbulb, Search, X } from "lucide-react";
import { useMemo } from "react";
import { FormFieldLabel } from "@/components/FormFieldLabel";
import { getContextualMotivacaoSuggestions } from "@/lib/motivacoes";
import { normalizeProceduralTagSearch } from "@/lib/proceduralTags";

type MotivacaoFieldProps = {
  value: string;
  query: string;
  onChange: (value: string) => void;
  onQueryChange: (value: string) => void;
  onSuggestionsOpenChange: (open: boolean) => void;
};

export function MotivacaoField({
  value,
  query,
  onChange,
  onQueryChange,
  onSuggestionsOpenChange,
}: MotivacaoFieldProps) {
  return (
    <div className="min-w-0">
      <FormFieldLabel label="Motivação" />
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary"
          aria-hidden="true"
        />
        <input
          value={value}
          onFocus={() => onSuggestionsOpenChange(true)}
          onBlur={(event) => {
            const nextElement = event.relatedTarget as HTMLElement | null;
            if (!nextElement?.closest("[data-motivacao-suggestions]")) {
              onSuggestionsOpenChange(false);
            }
          }}
          onChange={(event) => {
            const nextValue = event.target.value;
            onChange(nextValue);
            onQueryChange(nextValue);
            onSuggestionsOpenChange(true);
          }}
          placeholder="Digite livremente ou pesquise no catálogo"
          autoComplete="off"
          aria-controls="motivacao-suggestions"
          className="h-11 w-full rounded-lg border border-border bg-card pl-10 pr-10 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary"
        />
        {value ? (
          <button
            type="button"
            onBlur={(event) => {
              const nextElement = event.relatedTarget as HTMLElement | null;
              if (!nextElement?.closest("[data-motivacao-suggestions]")) {
                onSuggestionsOpenChange(false);
              }
            }}
            onClick={() => {
              onChange("");
              onQueryChange("");
              onSuggestionsOpenChange(true);
            }}
            className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Limpar motivação"
            title="Limpar motivação"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      {value && !query ? (
        <p className="mt-2 truncate text-xs text-muted-foreground" title={value}>
          Selecionada: <span className="font-semibold text-foreground">{value}</span>
        </p>
      ) : null}
    </div>
  );
}

type MotivacaoSuggestionsProps = {
  value: string;
  query: string;
  options: string[];
  tipificacoes: string[];
  onSelect: (value: string) => void;
};

export function MotivacaoSuggestions({
  value,
  query,
  options,
  tipificacoes,
  onSelect,
}: MotivacaoSuggestionsProps) {
  const suggestions = useMemo(
    () => getContextualMotivacaoSuggestions(options, tipificacoes, query),
    [options, query, tipificacoes],
  );
  const selectedKey = normalizeProceduralTagSearch(value);
  const contextLabel = tipificacoes.slice(0, 2).join(" + ");
  const extraContextCount = Math.max(0, tipificacoes.length - 2);

  return (
    <aside
      id="motivacao-suggestions"
      data-motivacao-suggestions
      className="rounded-xl border border-border/80 bg-card/90 p-4 shadow-lg backdrop-blur-sm lg:sticky lg:top-5"
      aria-label="Sugestões de motivação"
    >
      <div className="mb-3 flex min-w-0 items-start gap-2.5">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
          <Lightbulb className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">
            {query ? "Resultados do catálogo" : "Sugestões para o fato"}
          </p>
          <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
            {query
              ? `Busca por “${query}”`
              : contextLabel
                ? `${contextLabel}${extraContextCount ? ` +${extraContextCount}` : ""}`
                : "Sugestões gerais até informar a tipificação"}
          </p>
        </div>
      </div>

      <div className="space-y-1" role="listbox" aria-label="Opções de motivação">
        {suggestions.map((suggestion) => {
          const selected = selectedKey === normalizeProceduralTagSearch(suggestion);
          return (
            <button
              key={suggestion}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onSelect(suggestion)}
              className={`flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium transition ${
                selected
                  ? "bg-primary/15 text-primary"
                  : "text-foreground hover:bg-primary/10 hover:text-primary"
              }`}
            >
              <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center">
                {selected ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                )}
              </span>
              <span className="leading-4">{suggestion}</span>
            </button>
          );
        })}
        {suggestions.length === 0 ? (
          <p className="px-2.5 py-3 text-xs leading-5 text-muted-foreground">
            Nenhuma opção encontrada. O texto digitado ainda pode ser usado.
          </p>
        ) : null}
      </div>
    </aside>
  );
}
