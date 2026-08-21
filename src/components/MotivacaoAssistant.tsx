import { Check, Lightbulb, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { FormFieldLabel } from "@/components/FormFieldLabel";
import { getContextualMotivacaoSuggestions } from "@/lib/motivacoes";
import { normalizeProceduralTagSearch } from "@/lib/proceduralTags";

type MotivacaoAssistantProps = {
  value: string;
  options: string[];
  tipificacoes: string[];
  onChange: (value: string) => void;
};

export function MotivacaoAssistant({
  value,
  options,
  tipificacoes,
  onChange,
}: MotivacaoAssistantProps) {
  const [query, setQuery] = useState("");
  const suggestions = useMemo(
    () => getContextualMotivacaoSuggestions(options, tipificacoes, query),
    [options, query, tipificacoes],
  );
  const selectedKey = normalizeProceduralTagSearch(value);
  const contextLabel = tipificacoes.slice(0, 2).join(" + ");
  const extraContextCount = Math.max(0, tipificacoes.length - 2);

  return (
    <div className="grid gap-4 md:col-span-2 lg:col-span-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.9fr)] lg:gap-6">
      <div className="min-w-0">
        <FormFieldLabel label="Motivação" />
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary"
            aria-hidden="true"
          />
          <input
            value={value}
            onChange={(event) => {
              const nextValue = event.target.value;
              onChange(nextValue);
              setQuery(nextValue);
            }}
            placeholder="Digite livremente ou pesquise no catálogo"
            autoComplete="off"
            className="h-11 w-full rounded-lg border border-border bg-card pl-10 pr-10 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary"
          />
          {value ? (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setQuery("");
              }}
              className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Limpar motivação"
              title="Limpar motivação"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        {value ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Motivação registrada: <span className="font-semibold text-foreground">{value}</span>
          </p>
        ) : null}
      </div>

      <div className="min-w-0 lg:border-l lg:border-border/70 lg:pl-6">
        <div className="mb-2.5 flex min-w-0 items-start gap-2">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground">
              {query ? "Resultados do catálogo" : "Sugestões para o fato"}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {query
                ? `Busca por “${query}”`
                : contextLabel
                  ? `${contextLabel}${extraContextCount ? ` +${extraContextCount}` : ""}`
                  : "Sugestões gerais até informar a tipificação"}
            </p>
          </div>
        </div>

        <div
          className="max-h-52 space-y-1 overflow-y-auto pr-1"
          role="listbox"
          aria-label="Sugestões de motivação"
        >
          {suggestions.map((suggestion) => {
            const selected = selectedKey === normalizeProceduralTagSearch(suggestion);
            return (
              <button
                key={suggestion}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(suggestion);
                  setQuery("");
                }}
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
            <p className="px-2.5 py-3 text-xs text-muted-foreground">
              Nenhuma opção encontrada. O texto digitado ainda pode ser usado.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
