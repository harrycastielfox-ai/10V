import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Building2,
  CornerDownLeft,
  FileText,
  MapPin,
  Plus,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  searchNexoWorkspace,
  type NexoSearchResult,
  type NexoSearchTarget,
  type NexoWorkspaceSearchData,
} from "../nexoWorkspaceSearch";

export interface NexoCommandPaletteProps {
  open: boolean;
  onClose: () => void;
  data: NexoWorkspaceSearchData;
  onChoose: (target: NexoSearchTarget) => void;
  onCreatePerson: () => void;
  onCreateOrganization: () => void;
}

function ResultIcon({ result, selected }: { result: NexoSearchResult; selected: boolean }) {
  const Icon =
    result.target.kind === "person"
      ? UserRound
      : result.target.kind === "organization"
        ? Building2
        : result.target.kind === "territory"
          ? MapPin
          : result.target.kind === "procedure"
            ? FileText
            : ArrowUpRight;
  return (
    <span
      className={`relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border ${selected ? "border-white/10 bg-white/10 text-[#8fe1e8]" : "border-[#e0eaef] bg-[#eef5f8] text-[#168aa1]"}`}
    >
      {result.photo ? (
        <img src={result.photo} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <Icon className="h-4 w-4" />
      )}
      {result.color ? (
        <span
          className="absolute inset-x-0 bottom-0 h-1"
          style={{ backgroundColor: result.color }}
        />
      ) : null}
    </span>
  );
}

/** Local, non-persistent search. The parent owns navigation and the Ctrl+K shortcut. */
export function NexoCommandPalette({
  open,
  onClose,
  data,
  onChoose,
  onCreatePerson,
  onCreateOrganization,
}: NexoCommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const navigatingRef = useRef(false);
  const resultRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const listId = useId();
  const hintId = useId();
  const results = useMemo(() => searchNexoWorkspace(query, data), [query, data]);
  const selectedIndex = Math.min(activeIndex, Math.max(0, results.length - 1));

  useEffect(() => {
    if (open) {
      navigatingRef.current = false;
      setQuery("");
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (open) resultRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [open, selectedIndex, query]);

  function choose(result: NexoSearchResult) {
    navigatingRef.current = true;
    onClose();
    onChoose(result.target);
  }

  function handleKeys(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || !results.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((selectedIndex + direction + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(results[selectedIndex]);
    }
  }

  const create = (action: () => void) => {
    navigatingRef.current = true;
    onClose();
    action();
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1200] bg-[#081a27]/70 backdrop-blur-[4px]" />
        <Dialog.Content
          className="nexo-themed fixed inset-x-3 top-[5dvh] z-[1201] mx-auto flex max-h-[90dvh] w-auto max-w-[720px] flex-col overflow-hidden rounded-[20px] border border-[#d5e1e8] bg-white shadow-[0_28px_90px_-24px_#05172499] focus:outline-none sm:inset-x-6 sm:top-[8dvh] sm:max-h-[84dvh]"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            openerRef.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
            inputRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!navigatingRef.current && openerRef.current?.isConnected) openerRef.current.focus();
          }}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#e2eaef] bg-[#f6f9fb] px-4 py-3.5 sm:px-6">
            <Dialog.Title className="text-[11px] font-bold uppercase tracking-[.16em] text-[#47677c]">
              Busca global <span className="mx-2 text-[#bdcdd7]">/</span>
              <span className="text-[#168aa1]">NEXO</span>
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Fechar busca"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#dce5eb] bg-white text-[#567184] transition hover:border-[#a7c3d0] hover:text-[#12334a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168aa1]"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Encontre pessoas, facções, áreas, procedimentos vinculados ou abra uma área do NEXO.
          </Dialog.Description>
          <div className="flex shrink-0 items-center gap-3 border-b border-[#e2eaef] bg-white px-4 py-5 sm:px-6 sm:py-6">
            <Search className="h-5 w-5 shrink-0 text-[#168aa1]" aria-hidden="true" />
            <input
              ref={inputRef}
              role="combobox"
              aria-label="Buscar em todo o NEXO"
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={results.length ? `${listId}-${selectedIndex}` : undefined}
              aria-describedby={hintId}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeys}
              placeholder="Nome, apelido, documento, facção ou B.O."
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#12334a] outline-none placeholder:font-normal placeholder:text-[#567184] sm:text-base"
            />
            <kbd
              className="hidden shrink-0 rounded-md border border-[#dce6ec] bg-[#f6f9fb] px-2 py-1 text-[11px] font-medium text-[#567184] sm:block"
              aria-hidden="true"
            >
              Ctrl K
            </kbd>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-4 sm:px-3">
            <p
              id={hintId}
              className="flex items-center justify-between gap-3 px-3 pb-3 text-[11px] font-bold uppercase tracking-[.1em] text-[#567184]"
            >
              <span>
                {query.trim()
                  ? "Resultados nos registros acessíveis"
                  : "Navegação e registros acessíveis"}
              </span>
              <span className="rounded-md bg-[#eef3f7] px-2 py-0.5 tabular-nums tracking-normal text-[#47677c]">
                {results.length}
              </span>
            </p>
            <div id={listId} role="listbox" aria-label="Resultados da busca">
              {results.map((result, index) => (
                <button
                  key={result.id}
                  id={`${listId}-${index}`}
                  ref={(element) => {
                    resultRefs.current[index] = element;
                  }}
                  type="button"
                  role="option"
                  aria-selected={selectedIndex === index}
                  tabIndex={-1}
                  onMouseMove={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(result)}
                  className={`mb-1 flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${selectedIndex === index ? "border-[#12334a] bg-[#12334a] shadow-[0_4px_12px_-8px_#12334a80]" : "border-transparent hover:border-[#e0e9ef] hover:bg-[#f4f8fa]"}`}
                >
                  <ResultIcon result={result} selected={selectedIndex === index} />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-[13px] font-bold ${selectedIndex === index ? "text-white" : "text-[#12334a]"}`}
                    >
                      {result.label}
                    </span>
                    <span
                      className={`mt-1 block truncate text-xs leading-relaxed ${selectedIndex === index ? "text-[#c0d4df]" : "text-[#567184]"}`}
                    >
                      {result.detail}
                    </span>
                  </span>
                  <span
                    className={`hidden max-w-[145px] shrink-0 rounded-md px-2 py-1 text-right text-[11px] font-semibold sm:block ${selectedIndex === index ? "bg-white/10 text-[#a6e4eb]" : "bg-[#eef3f7] text-[#567184]"}`}
                  >
                    {result.category}
                  </span>
                  <ArrowUpRight
                    className={`h-4 w-4 shrink-0 ${selectedIndex === index ? "text-[#8fe1e8]" : "text-[#8ca6b5]"}`}
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
            {!results.length ? (
              <div className="mx-2 rounded-xl border border-dashed border-[#d7e3eb] bg-[#f7fafc] px-5 py-12 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#e9f1f5] text-[#567184]">
                  <Search className="h-5 w-5" />
                </span>
                <p className="mt-4 text-sm font-bold text-[#12334a]">Nenhum resultado encontrado</p>
                <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-[#567184]">
                  Tente outro nome, apelido, documento ou número de procedimento vinculado.
                </p>
              </div>
            ) : null}
            <p role="status" aria-live="polite" className="sr-only">
              {results.length} resultados exibidos.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-t border-[#dfe8ee] bg-[#f6f9fb] px-4 py-3.5 sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => create(onCreatePerson)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#d5e2ea] bg-white px-3 py-2 text-xs font-semibold text-[#355a70] transition hover:border-[#9fbfcf] hover:text-[#12334a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168aa1]"
              >
                <Plus className="h-3 w-3" /> Pessoa
              </button>
              <button
                type="button"
                onClick={() => create(onCreateOrganization)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#d5e2ea] bg-white px-3 py-2 text-xs font-semibold text-[#355a70] transition hover:border-[#9fbfcf] hover:text-[#12334a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168aa1]"
              >
                <Plus className="h-3 w-3" /> Facção
              </button>
            </div>
            <p
              className="flex flex-wrap items-center gap-3 text-[11px] text-[#567184]"
              aria-hidden="true"
            >
              <span className="inline-flex items-center gap-0.5">
                <ArrowUp className="h-3 w-3" />
                <ArrowDown className="h-3 w-3" /> navegar
              </span>
              <span className="inline-flex items-center gap-1">
                <CornerDownLeft className="h-3 w-3" /> abrir
              </span>
              <span>Esc fechar</span>
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
