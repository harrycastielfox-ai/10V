import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowLeft,
  Building2,
  Check,
  Eye,
  FileText,
  Image,
  Printer,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  createNexoReportConfig,
  listNexoReportPhotos,
  listNexoReportObservations,
  listNexoReportSources,
  NEXO_REPORT_SECTIONS,
  normalizeNexoReportConfig,
  selectNexoReportData,
  summarizeNexoReport,
  type NexoReportConfig,
  type NexoReportData,
} from "../nexoReportConfig";
import type { NexoReportScope } from "../nexoTypes";
import { NexoReport } from "./NexoReport";

const inputClass =
  "w-full rounded-lg border border-[#cfdee7] bg-white px-3 py-3 text-[13px] leading-relaxed text-[#12334a] outline-none placeholder:text-[#7b94a5] focus:border-[#168aa1] focus:ring-2 focus:ring-[#168aa1]/15 disabled:bg-[#f2f5f7]";

export function NexoReportConfigurator({
  initialScope,
  organizacoes,
  pessoas,
  territorios = [],
  registros = [],
  observacoes = [],
  onClose,
  onGenerate,
  busy = false,
}: NexoReportData & {
  initialScope: NexoReportScope;
  onClose: () => void;
  onGenerate: (scope: NexoReportScope, config: NexoReportConfig) => void;
  busy?: boolean;
}) {
  const [scope, setScope] = useState(initialScope);
  const [config, setConfig] = useState(createNexoReportConfig);
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false);
  const [observationPickerOpen, setObservationPickerOpen] = useState(false);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const data = useMemo(
    () => ({ organizacoes, pessoas, territorios, registros, observacoes }),
    [organizacoes, pessoas, territorios, registros, observacoes],
  );
  const selected = useMemo(() => selectNexoReportData(scope, data), [scope, data]);
  const summary = useMemo(() => summarizeNexoReport(scope, data, config), [scope, data, config]);
  const availablePhotos = useMemo(
    () => selected.people.flatMap((person) => listNexoReportPhotos(person)),
    [selected.people],
  );
  const availableObservations = useMemo(
    () => listNexoReportObservations(scope, data),
    [scope, data],
  );
  const availableSources = useMemo(
    () => selected.people.flatMap((person) => listNexoReportSources(person)),
    [selected.people],
  );
  const scopeExists =
    scope.kind === "geral" ||
    (scope.kind === "organizacao"
      ? organizacoes.some((org) => org.id === scope.organizacaoId)
      : pessoas.some((person) => person.id === scope.pessoaId));

  useEffect(() => {
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);

  function switchScope(kind: NexoReportScope["kind"]) {
    setScope(
      kind === "geral"
        ? { kind }
        : kind === "organizacao"
          ? { kind, organizacaoId: organizacoes[0]?.id || "" }
          : { kind, pessoaId: pessoas[0]?.id || "" },
    );
  }

  function openPhotoPicker() {
    setPhotoPickerOpen(true);
  }

  function setAllPhotosIncluded(included: boolean) {
    const selectedPersonIds = new Set(selected.people.map((person) => person.id));
    setConfig((current) => ({
      ...current,
      excludedPhotoPersonIds: current.excludedPhotoPersonIds.filter(
        (personId) => !selectedPersonIds.has(personId),
      ),
      photoOverrides: availablePhotos.reduce(
        (overrides, photo) => ({
          ...overrides,
          [photo.key]: { ...overrides[photo.key], included },
        }),
        { ...current.photoOverrides },
      ),
    }));
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && !busy && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1200] bg-[#081a27]/70 backdrop-blur-[4px]" />
        <Dialog.Content
          aria-busy={busy}
          className="nexo-themed fixed left-1/2 top-1/2 z-[1201] flex max-h-[calc(100dvh-24px)] w-[calc(100vw-24px)] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[20px] border border-[#cbdce5] bg-[#eef3f7] shadow-[0_28px_90px_-24px_#05172499] outline-none sm:max-h-[calc(100dvh-48px)] sm:w-[calc(100vw-48px)]"
        >
          <header className="shrink-0 border-t-[3px] border-[#168aa1] bg-[#12334a] px-5 py-5 text-white sm:px-7 sm:py-6">
            <div className="flex items-start gap-4">
              <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#89dce5] sm:flex">
                <FileText className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#8ed6e0]">
                  NEXO / Relatórios
                </p>
                <Dialog.Title className="mt-1.5 text-xl font-bold tracking-[-.025em] sm:text-2xl">
                  Monte o relatório
                </Dialog.Title>
                <Dialog.Description className="mt-2 max-w-xl text-xs leading-relaxed text-[#c3d5df] sm:text-[13px]">
                  Escolha o recorte, selecione as seções e revise as fotografias antes de gerar.
                </Dialog.Description>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={onClose}
                aria-label="Fechar configuração do relatório"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/20 text-[#d2e3eb] transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#89dce5] disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
            <fieldset
              disabled={busy}
              className="m-0 grid w-full min-w-0 items-start gap-4 border-0 p-4 sm:p-6 lg:grid-cols-[.82fr_1.18fr]"
            >
              <section
                className={`${photoPickerOpen || observationPickerOpen || sourcePickerOpen ? "hidden" : ""} rounded-xl border border-[#d6e3eb] bg-white p-4 sm:p-5`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[#d5e7ed] bg-[#edf7f9] text-[11px] font-bold text-[#168aa1]"
                    aria-hidden="true"
                  >
                    01
                  </span>
                  <h2 className="text-[13px] font-bold text-[#12334a]">Recorte do documento</h2>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[#567184]">
                  Defina quais registros farão parte deste relatório.
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2 lg:grid-cols-1">
                  {(
                    [
                      ["geral", "Geral", FileText],
                      ["organizacao", "Organização", Building2],
                      ["pessoa", "Pessoa", UserRound],
                    ] as const
                  ).map(([kind, label, Icon]) => (
                    <button
                      key={kind}
                      type="button"
                      aria-pressed={scope.kind === kind}
                      onClick={() => switchScope(kind)}
                      className={`inline-flex min-h-14 flex-col items-center justify-center gap-2 rounded-lg border px-2 py-3 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168aa1] lg:min-h-12 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-xs ${scope.kind === kind ? "border-[#168aa1] bg-[#edf7f9] text-[#126b80] ring-1 ring-inset ring-[#168aa1]/10" : "border-[#dce6ec] bg-white text-[#567184] hover:border-[#a9c5d2] hover:bg-[#f7fafc]"}`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
                {scope.kind === "organizacao" ? (
                  <label className="mt-4 block text-[11px] font-semibold text-[#47677c]">
                    Organização
                    <select
                      value={scope.organizacaoId}
                      onChange={(event) =>
                        setScope({ kind: "organizacao", organizacaoId: event.target.value })
                      }
                      className={`mt-1 ${inputClass}`}
                    >
                      {!organizacoes.length ? (
                        <option value="">Nenhuma organização cadastrada</option>
                      ) : null}
                      {organizacoes.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : scope.kind === "pessoa" ? (
                  <label className="mt-4 block text-[11px] font-semibold text-[#47677c]">
                    Pessoa
                    <select
                      value={scope.pessoaId}
                      onChange={(event) =>
                        setScope({ kind: "pessoa", pessoaId: event.target.value })
                      }
                      className={`mt-1 ${inputClass}`}
                    >
                      {!pessoas.length ? <option value="">Nenhuma pessoa cadastrada</option> : null}
                      {pessoas.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.nome}
                          {person.apelido ? ` · ${person.apelido}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </section>
              <section
                className={`${photoPickerOpen || observationPickerOpen || sourcePickerOpen ? "hidden" : ""} rounded-xl border border-[#d6e3eb] bg-white p-4 sm:p-5`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[#d5e7ed] bg-[#edf7f9] text-[11px] font-bold text-[#168aa1]"
                      aria-hidden="true"
                    >
                      02
                    </span>
                    <h2 className="text-[13px] font-bold text-[#12334a]">Conteúdo incluído</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setConfig((current) => ({
                        ...current,
                        sections: createNexoReportConfig().sections,
                      }))
                    }
                    className="rounded-md px-1 py-1 text-[11px] font-semibold text-[#127b92] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168aa1]"
                  >
                    Selecionar todas as seções
                  </button>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {NEXO_REPORT_SECTIONS.map(({ key, label, detail }) => (
                    <div
                      key={key}
                      className={`rounded-lg border p-3 transition focus-within:ring-2 focus-within:ring-[#168aa1]/25 ${config.sections[key] ? "border-[#a3c9d5] bg-[#f0f8fa]" : "border-[#dfe7ed] bg-white hover:border-[#b7cdd8]"}`}
                    >
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={config.sections[key]}
                          onChange={(event) =>
                            setConfig((current) => ({
                              ...current,
                              sections: { ...current.sections, [key]: event.target.checked },
                            }))
                          }
                          className="mt-0.5 h-4 w-4 shrink-0 accent-[#168aa1]"
                        />
                        <span>
                          <strong className="block text-xs font-semibold text-[#23475e]">
                            {label}
                          </strong>
                          <small className="mt-1 block text-[11px] leading-relaxed text-[#567184]">
                            {detail}
                          </small>
                        </span>
                      </label>
                      {key === "photographs" && config.sections.photographs ? (
                        <button
                          type="button"
                          onClick={openPhotoPicker}
                          className="mt-3 flex w-full items-center justify-between border-t border-[#cfe1e8] pt-2 text-left text-[11px] font-bold text-[#127b92] hover:text-[#0f6073] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168aa1]"
                        >
                          <span>Escolher fotos do álbum</span>
                          <span className="rounded-md bg-white px-2 py-1 tabular-nums text-[#355a70]">
                            {summary.photos}/{availablePhotos.length}
                          </span>
                        </button>
                      ) : null}
                      {key === "observations" && config.sections.observations ? (
                        <button
                          type="button"
                          onClick={() => setObservationPickerOpen(true)}
                          className="mt-3 flex w-full items-center justify-between border-t border-[#cfe1e8] pt-2 text-left text-[11px] font-bold text-[#127b92] hover:text-[#0f6073]"
                        >
                          <span>Escolher observações</span>
                          <span className="rounded-md bg-white px-2 py-1 tabular-nums text-[#355a70]">
                            {summary.observations}/{availableObservations.length}
                          </span>
                        </button>
                      ) : null}
                      {key === "sources" && config.sections.sources ? (
                        <button
                          type="button"
                          onClick={() => setSourcePickerOpen(true)}
                          className="mt-3 flex w-full items-center justify-between border-t border-[#cfe1e8] pt-2 text-left text-[11px] font-bold text-[#127b92] hover:text-[#0f6073]"
                        >
                          <span>Escolher fontes e PDFs</span>
                          <span className="rounded-md bg-white px-2 py-1 tabular-nums text-[#355a70]">
                            {summary.sources}/{availableSources.length}
                          </span>
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
                <p className="mt-4 border-t border-[#e4ecf1] pt-3 text-[11px] leading-relaxed text-[#567184]">
                  O nome das pessoas e o título do recorte permanecem como referência do documento.
                  Vínculos históricos são identificados e não representam participação atual.
                </p>
              </section>
              {config.sections.photographs ? (
                <section
                  className={`${photoPickerOpen ? "" : "hidden"} rounded-xl border border-[#d6e3eb] bg-white p-4 sm:p-5 lg:col-span-2`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[#d5e7ed] bg-[#edf7f9] text-[11px] font-bold text-[#168aa1]"
                        aria-hidden="true"
                      >
                        03
                      </span>
                      <div className="min-w-0">
                        <h2 className="flex items-center gap-2 text-[13px] font-bold leading-6 text-[#12334a]">
                          Fotografias e legendas
                          <Image className="h-4 w-4 text-[#168aa1]" aria-hidden="true" />
                        </h2>
                        <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-[#567184]">
                          As legendas abaixo pertencem somente a este relatório. Elas não alteram as
                          fotografias nem as anotações salvas no dossiê.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                      <button
                        type="button"
                        onClick={() => setPhotoPickerOpen(false)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[#d6e3eb] bg-white px-2.5 py-1.5 text-[#47677c] hover:bg-[#f7fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168aa1]"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" /> Voltar às seções
                      </button>
                      {availablePhotos.length ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setAllPhotosIncluded(true)}
                            className="rounded-md border border-[#cfe0e8] bg-[#f7fafc] px-2.5 py-1.5 text-[#126b80] hover:bg-[#edf7f9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168aa1]"
                          >
                            Selecionar todas
                          </button>
                          <button
                            type="button"
                            onClick={() => setAllPhotosIncluded(false)}
                            className="rounded-md border border-[#dce5eb] bg-white px-2.5 py-1.5 text-[#567184] hover:bg-[#f7f9fb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168aa1]"
                          >
                            Limpar seleção
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-4 space-y-4">
                    {selected.people.map((person) => {
                      const photos = listNexoReportPhotos(person);
                      if (!photos.length) return null;
                      const personIncluded = !config.excludedPhotoPersonIds.includes(person.id);
                      return (
                        <div
                          key={person.id}
                          className="overflow-hidden rounded-xl border border-[#dce6ed]"
                        >
                          <label className="flex flex-wrap items-center gap-2.5 border-b border-[#e2eaf0] bg-[#f7fafc] px-4 py-3 text-xs font-semibold text-[#23475e]">
                            <input
                              type="checkbox"
                              checked={personIncluded}
                              onChange={(event) =>
                                setConfig((current) => ({
                                  ...current,
                                  excludedPhotoPersonIds: event.target.checked
                                    ? current.excludedPhotoPersonIds.filter(
                                        (id) => id !== person.id,
                                      )
                                    : [...new Set([...current.excludedPhotoPersonIds, person.id])],
                                }))
                              }
                              className="h-4 w-4 shrink-0 accent-[#168aa1]"
                            />
                            Fotografias de {person.nome}
                            <span className="ml-auto rounded-md border border-[#dfe8ee] bg-white px-2 py-1 text-[11px] font-medium text-[#567184]">
                              {photos.length} disponível(is)
                            </span>
                          </label>
                          <div
                            className={`grid gap-3 p-3 sm:p-4 lg:grid-cols-2 ${personIncluded ? "" : "opacity-60"}`}
                          >
                            {photos.map((photo) => {
                              const override = config.photoOverrides[photo.key];
                              const included = override?.included !== false;
                              return (
                                <div
                                  key={photo.key}
                                  className={`flex flex-col gap-3 rounded-lg border bg-white p-3 min-[480px]:flex-row ${included && personIncluded ? "border-[#d7e4ec]" : "border-[#e4eaf0] bg-[#f7f9fb]"}`}
                                >
                                  <img
                                    src={photo.url}
                                    alt={`Fotografia disponível de ${person.nome}`}
                                    className="h-32 w-full shrink-0 rounded-md border border-[#e0e8ee] bg-[#eef3f7] object-contain min-[480px]:h-28 min-[480px]:w-24"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <label className="flex items-center gap-2 text-[11px] font-semibold text-[#355a70]">
                                      <input
                                        type="checkbox"
                                        checked={included}
                                        disabled={!personIncluded}
                                        onChange={(event) =>
                                          setConfig((current) => ({
                                            ...current,
                                            photoOverrides: {
                                              ...current.photoOverrides,
                                              [photo.key]: {
                                                ...current.photoOverrides[photo.key],
                                                included: event.target.checked,
                                              },
                                            },
                                          }))
                                        }
                                        className="h-4 w-4 shrink-0 accent-[#168aa1]"
                                      />
                                      {photo.kind === "principal"
                                        ? "Foto de referência"
                                        : "Incluir fotografia"}
                                    </label>
                                    <label className="mt-3 block text-[11px] font-medium text-[#567184]">
                                      Legenda no relatório
                                      <textarea
                                        value={override?.caption ?? photo.caption}
                                        disabled={!personIncluded || !included}
                                        maxLength={4000}
                                        rows={3}
                                        onChange={(event) =>
                                          setConfig((current) => ({
                                            ...current,
                                            photoOverrides: {
                                              ...current.photoOverrides,
                                              [photo.key]: {
                                                ...current.photoOverrides[photo.key],
                                                caption: event.target.value,
                                              },
                                            },
                                          }))
                                        }
                                        className={`mt-1 resize-y ${inputClass}`}
                                        placeholder="Contexto, data ou observação desta imagem..."
                                      />
                                    </label>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    {!selected.people.some((person) => listNexoReportPhotos(person).length) ? (
                      <p className="rounded-lg border border-dashed border-[#d2e1e9] bg-[#f7fafc] px-4 py-8 text-center text-xs text-[#567184]">
                        Nenhuma fotografia disponível neste recorte.
                      </p>
                    ) : null}
                  </div>
                </section>
              ) : null}
              {observationPickerOpen && config.sections.observations ? (
                <section className="rounded-xl border border-[#d6e3eb] bg-white p-4 sm:p-5 lg:col-span-2">
                  <h2 className="text-sm font-bold text-[#12334a]">
                    Escolher observações para o relatório
                  </h2>
                  <p className="mt-1 text-xs text-[#567184]">
                    A seleção afeta apenas este relatório, sem alterar os registros originais.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setObservationPickerOpen(false)}
                      className="rounded-md border border-[#d6e3eb] px-3 py-2 text-[#47677c]"
                    >
                      Voltar às seções
                    </button>
                    {[true, false].map((include) => (
                      <button
                        key={String(include)}
                        type="button"
                        onClick={() =>
                          setConfig((current) => {
                            const keys = new Set(availableObservations.map((entry) => entry.key));
                            return {
                              ...current,
                              excludedObservationKeys: [
                                ...current.excludedObservationKeys.filter((key) => !keys.has(key)),
                                ...(include ? [] : [...keys]),
                              ],
                            };
                          })
                        }
                        className="rounded-md border border-[#d6e3eb] px-3 py-2 text-[#126b80]"
                      >
                        {include ? "Selecionar todas" : "Limpar seleção"}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 space-y-3">
                    {availableObservations.map((entry) => (
                      <label
                        key={entry.key}
                        className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#dce6ed] p-4"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 shrink-0 accent-[#168aa1]"
                          checked={!config.excludedObservationKeys.includes(entry.key)}
                          onChange={(event) =>
                            setConfig((current) => ({
                              ...current,
                              excludedObservationKeys: event.target.checked
                                ? current.excludedObservationKeys.filter((key) => key !== entry.key)
                                : [...new Set([...current.excludedObservationKeys, entry.key])],
                            }))
                          }
                        />
                        <span className="min-w-0">
                          <strong className="block text-xs text-[#23475e]">{entry.title}</strong>
                          <span className="mt-2 block whitespace-pre-wrap break-words text-xs leading-relaxed text-[#567184]">
                            {entry.content}
                          </span>
                        </span>
                      </label>
                    ))}
                    {!availableObservations.length ? (
                      <p className="rounded-lg border border-dashed border-[#d2e1e9] p-6 text-center text-xs text-[#567184]">
                        Nenhuma observação disponível neste recorte.
                      </p>
                    ) : null}
                  </div>
                </section>
              ) : null}
              {sourcePickerOpen && config.sections.sources ? (
                <section className="rounded-xl border border-[#d6e3eb] bg-white p-4 sm:p-5 lg:col-span-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-bold text-[#12334a]">
                        Escolher fontes e documentos
                      </h2>
                      <p className="mt-1 text-xs leading-relaxed text-[#567184]">
                        Selecione os PDFs que serão identificados no relatório. A escolha não altera
                        nem remove os arquivos originais do dossiê.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                      <button
                        type="button"
                        onClick={() => setSourcePickerOpen(false)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[#d6e3eb] bg-white px-2.5 py-1.5 text-[#47677c] hover:bg-[#f7fafc]"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" /> Voltar às seções
                      </button>
                      {availableSources.length ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setConfig((current) => ({
                                ...current,
                                excludedSourceKeys: current.excludedSourceKeys.filter(
                                  (key) => !availableSources.some((source) => source.key === key),
                                ),
                              }))
                            }
                            className="rounded-md border border-[#cfe0e8] bg-[#f7fafc] px-2.5 py-1.5 text-[#126b80]"
                          >
                            Selecionar todas
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setConfig((current) => ({
                                ...current,
                                excludedSourceKeys: [
                                  ...current.excludedSourceKeys.filter(
                                    (key) => !availableSources.some((source) => source.key === key),
                                  ),
                                  ...availableSources.map((source) => source.key),
                                ],
                              }))
                            }
                            className="rounded-md border border-[#dce5eb] bg-white px-2.5 py-1.5 text-[#567184]"
                          >
                            Limpar seleção
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {availableSources.map((source) => {
                      const included = !config.excludedSourceKeys.includes(source.key);
                      const person = selected.people.find((entry) => entry.id === source.personId);
                      return (
                        <label
                          key={source.key}
                          className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#dce6ed] p-4"
                        >
                          <input
                            type="checkbox"
                            checked={included}
                            onChange={(event) =>
                              setConfig((current) => ({
                                ...current,
                                excludedSourceKeys: event.target.checked
                                  ? current.excludedSourceKeys.filter((key) => key !== source.key)
                                  : [...new Set([...current.excludedSourceKeys, source.key])],
                              }))
                            }
                            className="mt-0.5 h-4 w-4 shrink-0 accent-[#168aa1]"
                          />
                          <span className="min-w-0">
                            <strong className="block break-words text-xs text-[#23475e]">
                              {source.filename}
                            </strong>
                            <span className="mt-1 block text-[11px] font-semibold text-[#168aa1]">
                              {source.kind === "recurso"
                                ? "Recurso anexado"
                                : "PDF de origem da importação"}
                              {person ? ` · ${person.nome}` : ""}
                            </span>
                            <span className="mt-2 block text-xs leading-relaxed text-[#567184]">
                              {source.observation?.trim() || source.extraction}
                              {source.pageCount != null ? ` · ${source.pageCount} página(s)` : ""}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                    {!availableSources.length ? (
                      <p className="rounded-lg border border-dashed border-[#d2e1e9] p-6 text-center text-xs text-[#567184]">
                        Nenhum PDF ou documento-fonte disponível neste recorte.
                      </p>
                    ) : null}
                  </div>
                </section>
              ) : null}
            </fieldset>
          </div>
          <footer className="shrink-0 border-t border-[#d6e3eb] bg-white px-4 py-4 sm:px-6">
            <div
              role="status"
              aria-live="polite"
              className="flex items-start gap-3 border-b border-[#e3ebf0] pb-3"
            >
              <span className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#edf7f9] text-[#168aa1] sm:flex">
                <Check className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <strong className="text-[11px] font-bold uppercase tracking-[.08em] text-[#47677c]">
                  Prévia do conteúdo
                </strong>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] leading-relaxed text-[#567184]">
                  <span>
                    <b className="font-semibold tabular-nums text-[#12334a]">{summary.people}</b>{" "}
                    pessoa(s)
                  </span>
                  <span>
                    <b className="font-semibold tabular-nums text-[#12334a]">{summary.links}</b>{" "}
                    vínculo(s)
                  </span>
                  <span>
                    <b className="font-semibold tabular-nums text-[#12334a]">
                      {summary.procedures}
                    </b>{" "}
                    procedimento(s)
                  </span>
                  <span>
                    <b className="font-semibold tabular-nums text-[#12334a]">
                      {summary.territories}
                    </b>{" "}
                    território(s)
                  </span>
                  <span>
                    <b className="font-semibold tabular-nums text-[#12334a]">{summary.addresses}</b>{" "}
                    endereço(s)
                  </span>
                  <span>
                    <b className="font-semibold tabular-nums text-[#12334a]">
                      {summary.observations}
                    </b>{" "}
                    observação(ões)
                  </span>
                  <span>
                    <b className="font-semibold tabular-nums text-[#12334a]">{summary.photos}</b>{" "}
                    foto(s)
                  </span>
                  <span>
                    <b className="font-semibold tabular-nums text-[#12334a]">{summary.sources}</b>{" "}
                    fonte(s)
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
              <p className="text-[11px] leading-relaxed text-[#567184]">
                <strong className="font-semibold text-[#355a70]">
                  {summary.sections} de {NEXO_REPORT_SECTIONS.length} seções selecionadas
                </strong>
                <span className="ml-1.5">· impressão ou salvar como PDF</span>
              </p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={busy || !summary.sections || !scopeExists}
                  onClick={() => setPreviewOpen(true)}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-[#b9d4df] bg-white px-4 py-3 text-xs font-semibold text-[#234c63] transition hover:border-[#168aa1] hover:bg-[#f2fafb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168aa1] focus-visible:ring-offset-2 disabled:opacity-40"
                >
                  <Eye className="h-4 w-4" />
                  Prévia do documento
                </button>
                <button
                  type="button"
                  disabled={busy || !summary.sections || !scopeExists}
                  onClick={() => onGenerate(scope, normalizeNexoReportConfig(config))}
                  className="nexo-action-primary inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#12334a] px-5 py-3 text-xs font-semibold text-white transition hover:bg-[#1d4b65] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168aa1] focus-visible:ring-offset-2 disabled:opacity-40"
                >
                  <Printer className="h-4 w-4" />
                  {busy ? "Preparando relatório..." : "Gerar relatório"}
                </button>
              </div>
            </div>
          </footer>
          {previewOpen ? (
            <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-[#071d30]/80 p-3 backdrop-blur-sm sm:p-6">
              <section
                aria-label="Prévia do documento"
                className="flex h-full max-h-[calc(100dvh-24px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[#c8dce5] bg-[#dfe8ed] shadow-2xl sm:max-h-[calc(100dvh-48px)]"
              >
                <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#c8dce5] bg-white px-4 py-3 sm:px-6">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#168aa1]">
                      Conferência antes da exportação
                    </p>
                    <h2 className="mt-1 text-sm font-black text-[#12334a]">
                      Prévia do documento A4
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(false)}
                    aria-label="Fechar prévia do documento"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#cbdde6] text-[#36566d] transition hover:bg-[#eef6f8]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </header>
                <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-6">
                  <NexoReport
                    scope={scope}
                    organizacoes={organizacoes}
                    pessoas={pessoas}
                    territorios={territorios}
                    registros={registros}
                    observacoes={observacoes}
                    config={normalizeNexoReportConfig(config)}
                    screenPreview
                  />
                </div>
              </section>
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
