import { Bookmark, BookmarkCheck, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  MAX_PROCEDURE_VIEWS,
  parseProcedureViews,
  sameProcedureView,
  type ProcedureViewState,
  type SavedProcedureView,
} from "../nexoProcedureViews";

export function NexoProcedureSavedViews({
  current,
  onApply,
  preview,
  ownerKey,
}: {
  current: ProcedureViewState;
  onApply: (state: ProcedureViewState) => void;
  preview: boolean;
  ownerKey: string | null;
}) {
  const storageKey = preview
    ? "nexo-procedure-views-v1-preview"
    : ownerKey
      ? `nexo-procedure-views-v1-user-${ownerKey}`
      : null;
  const [views, setViews] = useState<SavedProcedureView[]>([]);
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setViews([]);
    setName("");
    setNotice("");
    setReady(false);
    try {
      if (storageKey) setViews(parseProcedureViews(window.localStorage.getItem(storageKey)));
    } catch {
      setNotice(
        "O navegador está restringindo o armazenamento. As visões ficarão disponíveis nesta sessão.",
      );
    }
    setReady(true);
  }, [storageKey]);

  function persist(next: SavedProcedureView[]) {
    setViews(next);
    try {
      if (!storageKey) return false;
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      return true;
    } catch {
      return false;
    }
  }

  function save() {
    const label = name.trim();
    if (!label) {
      setNotice("Dê um nome à visão para salvar o recorte atual.");
      return;
    }
    const previous = views.find(
      (view) => view.name.toLocaleLowerCase("pt-BR") === label.toLocaleLowerCase("pt-BR"),
    );
    if (!previous && views.length >= MAX_PROCEDURE_VIEWS) {
      setNotice(
        `Você pode manter até ${MAX_PROCEDURE_VIEWS} visões. Remova uma delas para criar outra.`,
      );
      return;
    }
    const view: SavedProcedureView = {
      id: previous?.id || crypto.randomUUID(),
      name: label,
      state: structuredClone(current),
      createdAt: new Date().toISOString(),
    };
    if (!parseProcedureViews(JSON.stringify([view])).length) {
      setNotice("Ajuste o intervalo ou os filtros antes de salvar esta visão.");
      return;
    }
    const next = [view, ...views.filter((item) => item.id !== view.id)];
    if (parseProcedureViews(JSON.stringify(next)).length !== next.length) {
      setNotice(
        "Esta seleção é extensa demais para uma visão local. Reduza a seleção de pontos do mapa.",
      );
      return;
    }
    const saved = persist(next);
    setName("");
    setNotice(
      saved
        ? `Visão “${label}” ${previous ? "atualizada" : "salva"} neste navegador.`
        : `Visão “${label}” guardada nesta sessão; armazenamento indisponível.`,
    );
  }

  return (
    <section className="mt-4 rounded-[22px] border border-[#d9e7ee] bg-white px-5 py-4 shadow-[0_10px_25px_-26px_#173f58]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-2.5">
          <Bookmark className="mt-0.5 h-4 w-4 text-[#2d8b9f]" />
          <div>
            <h2 className="text-xs font-black text-[#315a71]">Minhas visões</h2>
            <p className="mt-1 text-[11px] text-[#8ca3b1]">
              Guarde filtros, datas, seleção do mapa e ordenação neste navegador para repetir a
              consulta.
            </p>
          </div>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
          className="flex min-w-0 flex-wrap gap-2"
        >
          <label className="sr-only" htmlFor="procedure-view-name">
            Nome da visão
          </label>
          <input
            id="procedure-view-name"
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: CVLI · Centro"
            className="h-9 w-48 max-w-full rounded-xl border border-[#d7e5ec] px-3 text-[11px] text-[#315a71] outline-none placeholder:text-[#a0b2bd] focus:border-[#55a9bc] focus:ring-2 focus:ring-[#def3f6]"
          />
          <button
            disabled={!ready}
            type="submit"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#bddde5] bg-[#eff9fb] px-3 text-[11px] font-bold text-[#28798f] hover:bg-[#e0f4f8] disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            Salvar visão
          </button>
        </form>
      </div>
      {views.length ? (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-[#edf3f6] pt-3">
          {views.map((view) => {
            const active = sameProcedureView(view.state, current);
            return (
              <div
                key={view.id}
                className={`inline-flex max-w-full items-center overflow-hidden rounded-xl border ${active ? "border-[#84bdcc] bg-[#edf8fa]" : "border-[#dde8ee] bg-[#fafcfd]"}`}
              >
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    onApply(structuredClone(view.state));
                    setNotice(`Visão “${view.name}” aplicada.`);
                  }}
                  title={
                    view.state.filters.from || view.state.filters.to
                      ? `${view.state.filters.from || "Início"} a ${view.state.filters.to || "Atual"}`
                      : "Todo o histórico"
                  }
                  className="inline-flex min-w-0 items-center gap-1.5 px-3 py-2 text-[11px] font-bold text-[#42778d] hover:bg-[#eaf5f8]"
                >
                  {active ? (
                    <BookmarkCheck className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <Bookmark className="h-3.5 w-3.5 shrink-0 opacity-50" />
                  )}
                  <span className="max-w-56 truncate">{view.name}</span>
                </button>
                <button
                  type="button"
                  aria-label={`Remover visão ${view.name}`}
                  title="Remover visão salva"
                  onClick={() => {
                    persist(views.filter((item) => item.id !== view.id));
                    setNotice(`Visão “${view.name}” removida.`);
                  }}
                  className="border-l border-[#dce8ee] px-2 py-2 text-[#88a3b2] hover:bg-[#fff1ef] hover:text-[#b65f52]"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-[#a0b1bc]">
          Nenhuma visão salva. O recorte guarda as datas exatas selecionadas.
        </p>
      )}
      {notice ? (
        <p role="status" className="mt-2 text-[11px] text-[#5d8d9e]">
          {notice}
        </p>
      ) : null}
    </section>
  );
}
