import { FileSearch, LoaderCircle, Trash2, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  defaultNexoPdfSelections,
  readNexoPdf,
  readNexoPdfPageCount,
  readNexoPdfPhotos,
  readNexoPdfWithOcr,
  type NexoPdfCandidate,
  type NexoPdfField,
  type NexoPdfPhotoSelection,
  type NexoPdfPhotoTarget,
} from "../nexoPdfImport";
import type { NexoPdfSourceInput } from "../nexoTypes";

type PdfDocumentState = {
  id: string;
  file: File;
  pageCount: number | null;
  ocrStatus: "nao_aplicado" | "pendente" | "concluido";
  candidates: NexoPdfCandidate[];
  photos: Awaited<ReturnType<typeof readNexoPdfPhotos>>;
  error: string;
  photoError: string;
  ocrBusy: boolean;
};

type CandidateView = NexoPdfCandidate & {
  documentId: string;
  documentName: string;
  originalId: string;
};

export function NexoPdfImportPanel({
  onApply,
  onBack,
}: {
  onApply: (sources: NexoPdfSourceInput[], photos: NexoPdfPhotoSelection[]) => void;
  onBack: () => void;
}) {
  const [documents, setDocuments] = useState<PdfDocumentState[]>([]);
  const [chosen, setChosen] = useState<Partial<Record<NexoPdfField, string>>>({});
  const [photoChoices, setPhotoChoices] = useState<
    Record<string, { id: string; target: NexoPdfPhotoTarget }>
  >({});
  const [busy, setBusy] = useState(false);
  const [fileWarning, setFileWarning] = useState("");
  const [pdfPreviewUrls, setPdfPreviewUrls] = useState<Record<string, string>>({});
  const documentsRef = useRef<PdfDocumentState[]>([]);

  useEffect(() => {
    documentsRef.current = documents;
  }, [documents]);
  useEffect(() => {
    const next = Object.fromEntries(
      documents.map((document) => [document.id, URL.createObjectURL(document.file)]),
    );
    setPdfPreviewUrls(next);
    return () => Object.values(next).forEach((url) => URL.revokeObjectURL(url));
  }, [documents]);
  useEffect(
    () => () => {
      for (const photo of documentsRef.current.flatMap((document) => document.photos))
        URL.revokeObjectURL(photo.previewUrl);
    },
    [],
  );

  const candidates = useMemo<CandidateView[]>(
    () =>
      documents.flatMap((document) =>
        document.candidates.map((candidate) => ({
          ...candidate,
          id: document.id + ":" + candidate.id,
          originalId: candidate.id,
          documentId: document.id,
          documentName: document.file.name,
        })),
      ),
    [documents],
  );
  const groups = useMemo(() => {
    const byField = new Map<NexoPdfField, CandidateView[]>();
    for (const item of candidates)
      byField.set(item.field, [...(byField.get(item.field) || []), item]);
    return [...byField.entries()];
  }, [candidates]);
  const selectedCandidates = candidates.filter((item) => chosen[item.field] === item.id);
  const ready = documents.length > 0 && documents.every((document) => document.pageCount !== null);

  async function loadFiles(files: File[]) {
    if (!files.length || busy) return;
    const available = 3 - documents.length;
    const nextFiles = files.slice(0, Math.max(available, 0));
    setFileWarning(
      files.length > nextFiles.length
        ? "O limite é de três PDFs por cadastro. Os arquivos excedentes não foram adicionados."
        : "",
    );
    if (!nextFiles.length) return;
    setBusy(true);
    const loaded: PdfDocumentState[] = [];
    for (const file of nextFiles) loaded.push(await loadFile(file));
    setDocuments((current) => [...current, ...loaded]);
    const defaults = defaultNexoPdfSelections(
      loaded.flatMap((document) =>
        document.candidates.map((candidate) => ({
          ...candidate,
          id: document.id + ":" + candidate.id,
        })),
      ),
    );
    setChosen((current) => {
      const next = { ...current };
      for (const [field, id] of Object.entries(defaults) as [NexoPdfField, string][])
        if (!next[field]) next[field] = id;
      return next;
    });
    setBusy(false);
  }

  async function loadFile(file: File): Promise<PdfDocumentState> {
    const document: PdfDocumentState = {
      id: crypto.randomUUID(),
      file,
      pageCount: null,
      ocrStatus: "nao_aplicado",
      candidates: [],
      photos: [],
      error: "",
      photoError: "",
      ocrBusy: false,
    };
    try {
      document.pageCount = await readNexoPdfPageCount(file);
      try {
        document.candidates = await readNexoPdf(file);
        if (!document.candidates.length)
          document.error = "Nenhum campo de pessoa foi reconhecido. Você pode revisar manualmente.";
      } catch (cause) {
        document.error = cause instanceof Error ? cause.message : "Não foi possível extrair texto.";
        document.ocrStatus = document.error.includes("OCR") ? "pendente" : "nao_aplicado";
      }
      try {
        document.photos = await readNexoPdfPhotos(file);
      } catch (cause) {
        document.photoError =
          cause instanceof Error ? cause.message : "Não foi possível extrair imagens deste PDF.";
      }
    } catch (cause) {
      document.error = cause instanceof Error ? cause.message : "Não foi possível ler o PDF.";
    }
    return document;
  }

  function removeDocument(documentId: string) {
    const removed = documents.find((document) => document.id === documentId);
    if (removed) for (const photo of removed.photos) URL.revokeObjectURL(photo.previewUrl);
    const candidateIds = new Set(
      removed?.candidates.map((candidate) => documentId + ":" + candidate.id) || [],
    );
    setDocuments((current) => current.filter((document) => document.id !== documentId));
    setChosen((current) =>
      Object.fromEntries(Object.entries(current).filter(([, id]) => !candidateIds.has(id))),
    );
    setPhotoChoices((current) => {
      const next = { ...current };
      delete next[documentId];
      return next;
    });
  }

  function choosePhoto(documentId: string, photoId: string, target: NexoPdfPhotoTarget) {
    setPhotoChoices((current) => {
      const next = { ...current };
      for (const [id, choice] of Object.entries(next)) {
        if (id !== documentId && choice.target === target) delete next[id];
      }
      next[documentId] = { id: photoId, target };
      return next;
    });
  }

  async function runOcr(documentId: string) {
    const source = documents.find((document) => document.id === documentId);
    if (!source || source.ocrBusy || !source.pageCount) return;
    setDocuments((current) =>
      current.map((document) =>
        document.id === documentId ? { ...document, ocrBusy: true, error: "" } : document,
      ),
    );
    try {
      const extracted = await readNexoPdfWithOcr(source.file);
      setDocuments((current) =>
        current.map((document) =>
          document.id === documentId
            ? {
                ...document,
                candidates: extracted,
                ocrStatus: "concluido",
                ocrBusy: false,
                error: extracted.length
                  ? "OCR local concluído. Confira os valores e as páginas."
                  : "OCR concluído, mas nenhum campo foi reconhecido.",
              }
            : document,
        ),
      );
      const defaults = defaultNexoPdfSelections(
        extracted.map((candidate) => ({
          ...candidate,
          id: documentId + ":" + candidate.id,
        })),
      );
      setChosen((current) => {
        const next = { ...current };
        for (const [field, id] of Object.entries(defaults) as [NexoPdfField, string][])
          if (!next[field]) next[field] = id;
        return next;
      });
    } catch (cause) {
      setDocuments((current) =>
        current.map((document) =>
          document.id === documentId
            ? {
                ...document,
                ocrBusy: false,
                error: cause instanceof Error ? cause.message : "Não foi possível executar o OCR.",
              }
            : document,
        ),
      );
    }
  }

  function apply() {
    if (!ready) return;
    const sources = documents.map((document) => ({
      file: document.file,
      candidates: selectedCandidates
        .filter((candidate) => candidate.documentId === document.id)
        .map(
          ({
            id: _id,
            documentId: _documentId,
            documentName: _documentName,
            originalId: _originalId,
            ...candidate
          }) => candidate,
        ),
      page_count: document.pageCount!,
      ocr_status: document.ocrStatus,
    }));
    const photos = documents
      .map((document) => {
        const choice = photoChoices[document.id];
        const candidate = document.photos.find((photo) => photo.id === choice?.id);
        return candidate && choice ? { candidate, target: choice.target } : null;
      })
      .filter((photo): photo is NexoPdfPhotoSelection => Boolean(photo));
    onApply(sources, photos);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#c8dce5] bg-white p-5">
        <div className="flex items-center gap-3 text-[#183e57]">
          <UploadCloud className="h-6 w-6 text-[#168da4]" />
          <div>
            <h3 className="font-black">Importar até 3 PDFs com revisão</h3>
            <p className="text-xs text-[#627d8e]">
              As fontes serão combinadas no mesmo cadastro. Valores conflitantes continuam separados
              para você escolher.
            </p>
          </div>
        </div>
        <label className="mt-4 block cursor-pointer rounded-xl border-2 border-dashed border-[#a8cbd7] bg-[#f5fafb] p-5 text-center text-sm font-semibold text-[#216e83] hover:bg-[#eaf6f8]">
          {busy ? "Lendo documentos…" : "Selecionar PDF(s) (até 3 arquivos, 15 MB cada)"}
          <input
            type="file"
            accept=".pdf,application/pdf"
            multiple
            disabled={busy || documents.length >= 3}
            className="sr-only"
            onChange={(event) => {
              void loadFiles(Array.from(event.target.files || []));
              event.currentTarget.value = "";
            }}
          />
        </label>
        {fileWarning ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {fileWarning}
          </p>
        ) : null}
        <p className="mt-3 text-xs leading-5 text-[#627d8e]">
          Cada PDF mantém seu nome, páginas, hash e candidatos de origem. PDFs digitalizados podem
          usar OCR local individualmente.
        </p>
      </div>

      {documents.length ? (
        <section className="grid gap-4 lg:grid-cols-3">
          {documents.map((document) => (
            <article key={document.id} className="rounded-2xl border border-[#c8dce5] bg-white p-4">
              <div className="flex items-start gap-3">
                <FileSearch className="mt-0.5 h-5 w-5 shrink-0 text-[#168da4]" />
                <div className="min-w-0 flex-1">
                  <h3 className="break-words text-sm font-black text-[#183e57]">
                    {document.file.name}
                  </h3>
                  <p className="mt-1 text-[11px] text-[#627d8e]">
                    {document.pageCount
                      ? document.pageCount + " página(s)"
                      : "Arquivo inválido ou não lido"}
                    {" · "}
                    {document.candidates.length} campo(s)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeDocument(document.id)}
                  className="rounded-lg p-1.5 text-[#a35f64] hover:bg-[#fff0f0]"
                  aria-label={"Remover " + document.file.name}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {document.error ? (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] leading-relaxed text-amber-950">
                  <p>{document.error}</p>
                  {document.ocrStatus === "pendente" && document.pageCount ? (
                    <button
                      type="button"
                      onClick={() => void runOcr(document.id)}
                      disabled={document.ocrBusy}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 font-bold text-amber-900 disabled:opacity-50"
                    >
                      {document.ocrBusy ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      {document.ocrBusy ? "Executando OCR…" : "Tentar OCR local"}
                    </button>
                  ) : null}
                </div>
              ) : null}
              {document.photoError ? (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-950">
                  Imagens: {document.photoError}
                </p>
              ) : null}
              {document.pageCount ? (
                <iframe
                  title={"Prévia de " + document.file.name}
                  src={pdfPreviewUrls[document.id]}
                  className="mt-3 h-56 w-full rounded-lg border border-[#d8e5eb] bg-[#f8fafb]"
                />
              ) : null}
            </article>
          ))}
        </section>
      ) : null}

      {groups.length ? (
        <section className="rounded-2xl border border-[#c8dce5] bg-white p-5">
          <h3 className="flex items-center gap-2 text-sm font-black text-[#183e57]">
            <FileSearch className="h-4 w-4" /> Campos encontrados ({groups.length})
          </h3>
          <p className="mt-1 text-xs text-[#627d8e]">
            Escolha uma opção por campo. O nome do PDF e a página aparecem em cada alternativa.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {groups.map(([field, items]) => (
              <div key={field} className="rounded-xl border border-[#d8e5eb] p-3">
                <strong className="text-xs text-[#173d5b]">{items[0].label}</strong>
                {new Set(items.map((item) => item.value)).size > 1 ? (
                  <p className="mt-1 text-[11px] font-semibold text-amber-700">
                    Confira os valores encontrados em fontes diferentes.
                  </p>
                ) : null}
                <label className="mt-2 flex items-start gap-2 text-xs text-[#516b7d]">
                  <input
                    type="radio"
                    name={"pdf-" + field}
                    checked={!chosen[field]}
                    onChange={() => setChosen((current) => ({ ...current, [field]: undefined }))}
                  />{" "}
                  Não importar este campo
                </label>
                {items.map((item) => (
                  <label
                    key={item.id}
                    className="mt-2 flex items-start gap-2 rounded-lg bg-[#f6f9fa] p-2 text-xs text-[#183e57]"
                  >
                    <input
                      type="radio"
                      name={"pdf-" + field}
                      checked={chosen[field] === item.id}
                      onChange={() => setChosen((current) => ({ ...current, [field]: item.id }))}
                    />
                    <span className="min-w-0 break-words">
                      <span className="block font-semibold">{item.value}</span>
                      <span className="block text-[11px] text-[#698294]">
                        {item.documentName} · {item.source} · página {item.page} ·{" "}
                        {item.confidence === "alta" ? "leitura direta" : "revisar"}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {documents.some((document) => document.photos.length) ? (
        <section className="rounded-2xl border border-[#c8dce5] bg-white p-5">
          <h3 className="text-sm font-black text-[#183e57]">Imagens encontradas nas fontes</h3>
          <p className="mt-1 text-xs text-[#627d8e]">
            Selecione no máximo uma foto de perfil e uma de relatório. Nenhuma imagem será importada
            sem escolha explícita.
          </p>
          <div className="mt-4 space-y-5">
            {documents
              .filter((document) => document.photos.length)
              .map((document) => (
                <div key={document.id}>
                  <p className="text-xs font-black text-[#365b70]">{document.file.name}</p>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {document.photos.map((photo) => {
                      const choice = photoChoices[document.id];
                      const selected = choice?.id === photo.id;
                      return (
                        <div
                          key={photo.id}
                          className={
                            "rounded-xl border p-2 " +
                            (selected
                              ? "border-[#7d5eea] bg-[#f8f5ff]"
                              : "border-[#d8e5eb] bg-[#f8fafb]")
                          }
                        >
                          <button
                            type="button"
                            className="block w-full text-left"
                            onClick={() =>
                              choosePhoto(
                                document.id,
                                photo.id,
                                photoChoices[document.id]?.target || "perfil",
                              )
                            }
                          >
                            <img
                              src={photo.previewUrl}
                              alt={"Imagem extraída da página " + photo.page}
                              className="h-36 w-full rounded-lg bg-white object-contain"
                            />
                            <span className="mt-2 block text-xs font-semibold text-[#183e57]">
                              Página {photo.page} · {photo.width} × {photo.height}px
                            </span>
                          </button>
                          {selected ? (
                            <div className="mt-2 flex gap-3 text-xs font-semibold text-[#365b70]">
                              {(["perfil", "relatorio"] as const).map((target) => (
                                <label key={target} className="flex items-center gap-1">
                                  <input
                                    type="radio"
                                    name={"pdf-photo-target-" + document.id}
                                    checked={choice.target === target}
                                    onChange={() => choosePhoto(document.id, photo.id, target)}
                                  />
                                  {target === "perfil" ? "Perfil" : "Relatório"}
                                </label>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap justify-between gap-3">
        <button type="button" onClick={onBack} className="nexo-action-secondary">
          Voltar
        </button>
        <button
          type="button"
          disabled={!ready || busy}
          onClick={apply}
          className="nexo-action-primary disabled:opacity-40"
        >
          Revisar no cadastro ({documents.length} PDF{documents.length === 1 ? "" : "s"})
        </button>
      </div>
    </div>
  );
}
