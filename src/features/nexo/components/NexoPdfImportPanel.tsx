import { FileSearch, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

export function NexoPdfImportPanel({
  onApply,
  onBack,
}: {
  onApply: (
    candidates: NexoPdfCandidate[],
    fileName: string,
    photo: NexoPdfPhotoSelection | null,
    file: File,
    pageCount: number,
    ocrStatus: "nao_aplicado" | "pendente" | "concluido",
  ) => void;
  onBack: () => void;
}) {
  const [fileName, setFileName] = useState("");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [ocrStatus, setOcrStatus] = useState<"nao_aplicado" | "pendente" | "concluido">(
    "nao_aplicado",
  );
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
  const [candidates, setCandidates] = useState<NexoPdfCandidate[]>([]);
  const [chosen, setChosen] = useState<Partial<Record<NexoPdfField, string>>>({});
  const [photos, setPhotos] = useState<Awaited<ReturnType<typeof readNexoPdfPhotos>>>([]);
  const [photoChoice, setPhotoChoice] = useState<{
    id: string;
    target: NexoPdfPhotoTarget;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [error, setError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const groups = useMemo(() => {
    const byField = new Map<NexoPdfField, NexoPdfCandidate[]>();
    for (const item of candidates)
      byField.set(item.field, [...(byField.get(item.field) || []), item]);
    return [...byField.entries()];
  }, [candidates]);

  useEffect(() => () => photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl)), [photos]);

  useEffect(() => {
    if (!sourceFile) {
      setPdfPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(sourceFile);
    setPdfPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [sourceFile]);

  async function load(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    setSourceFile(file);
    setPageCount(null);
    setOcrStatus("nao_aplicado");
    setFileName(file.name);
    setCandidates([]);
    setChosen({});
    setPhotos([]);
    setPhotoChoice(null);
    setPhotoError("");
    try {
      const count = await readNexoPdfPageCount(file);
      setPageCount(count);
      let extracted: NexoPdfCandidate[] = [];
      try {
        extracted = await readNexoPdf(file);
        setCandidates(extracted);
        setChosen(defaultNexoPdfSelections(extracted));
        if (!extracted.length) {
          setError(
            "O PDF foi aberto, mas nenhum campo de pessoa foi reconhecido. Você pode continuar no cadastro manual e manter o documento-fonte.",
          );
        }
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "Não foi possível extrair texto.";
        setError(message);
        setOcrStatus(message.includes("OCR") ? "pendente" : "nao_aplicado");
      }
      try {
        const extractedPhotos = await readNexoPdfPhotos(file);
        setPhotos(extractedPhotos);
        // A single candidate is safe to stage for review; multiple candidates require an explicit choice.
        setPhotoChoice(
          extractedPhotos.length === 1 ? { id: extractedPhotos[0].id, target: "perfil" } : null,
        );
      } catch (cause) {
        setPhotoError(
          cause instanceof Error ? cause.message : "Não foi possível extrair imagens deste PDF.",
        );
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível ler o PDF.");
      setPageCount(null);
    } finally {
      setBusy(false);
    }
  }

  async function runOcr() {
    if (!sourceFile || !pageCount || ocrBusy) return;
    setOcrBusy(true);
    setError("");
    try {
      const extracted = await readNexoPdfWithOcr(sourceFile);
      setCandidates(extracted);
      setChosen(defaultNexoPdfSelections(extracted));
      setOcrStatus("concluido");
      setError(
        extracted.length
          ? "OCR local concluído. Confira cada valor e a página original antes de continuar."
          : "OCR local concluído, mas nenhum campo de pessoa foi reconhecido. Continue no cadastro manual se necessário.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível executar o OCR local.");
    } finally {
      setOcrBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#c8dce5] bg-white p-5">
        <div className="flex items-center gap-3 text-[#183e57]">
          <UploadCloud className="h-6 w-6 text-[#168da4]" />
          <div>
            <h3 className="font-black">Importar PDF com revisão</h3>
            <p className="text-xs text-[#627d8e]">
              Leitura no navegador. Nenhum dado é salvo até você revisar o cadastro completo.
            </p>
          </div>
        </div>
        <label className="mt-4 block cursor-pointer rounded-xl border-2 border-dashed border-[#a8cbd7] bg-[#f5fafb] p-5 text-center text-sm font-semibold text-[#216e83] hover:bg-[#eaf6f8]">
          {busy
            ? "Lendo documento…"
            : fileName
              ? `Trocar arquivo: ${fileName}`
              : "Selecionar PDF (até 15 MB e 30 páginas)"}
          <input
            type="file"
            accept=".pdf,application/pdf"
            disabled={busy}
            className="sr-only"
            onChange={(event) => void load(event.target.files?.[0])}
          />
        </label>
        <p className="mt-3 text-xs leading-5 text-[#627d8e]">
          PDFs digitalizados sem texto selecionável precisam de OCR. Se houver valores diferentes
          para o mesmo campo, escolha um após conferir a página original.
        </p>
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
          O arquivo original será preservado de forma privada com hash, autor e página(s) após a
          ficha ser salva. Somente os campos que você confirmar entram na ficha.
        </p>
      </div>
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950"
        >
          <>
            <span>{error}</span>
            {ocrStatus === "pendente" && sourceFile && pageCount ? (
              <button
                type="button"
                onClick={() => void runOcr()}
                disabled={ocrBusy}
                className="mt-3 block rounded-lg border border-amber-300 bg-white px-3 py-2 font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
              >
                {ocrBusy ? "Executando OCR local…" : "Tentar OCR local"}
              </button>
            ) : null}
          </>
        </p>
      ) : null}
      <div
        className={
          sourceFile && pageCount
            ? "grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
            : "space-y-5"
        }
      >
        {sourceFile && pageCount ? (
          <section className="overflow-hidden rounded-2xl border border-[#c8dce5] bg-[#edf3f6] p-3 lg:sticky lg:top-4 lg:self-start">
            <div className="flex items-center justify-between gap-3 px-2 pb-3">
              <div>
                <h3 className="text-sm font-black text-[#183e57]">Prévia do PDF</h3>
                <p className="mt-1 text-xs text-[#627d8e]">
                  {pageCount} página(s) · documento original preservado após salvar
                </p>
              </div>
              <FileSearch className="h-5 w-5 text-[#168da4]" />
            </div>
            <iframe
              title={`Prévia de ${fileName}`}
              src={pdfPreviewUrl}
              className="h-[560px] w-full rounded-xl border border-[#d8e5eb] bg-white"
            />
          </section>
        ) : null}
        {groups.length ? (
          <section className="rounded-2xl border border-[#c8dce5] bg-white p-5">
            <h3 className="flex items-center gap-2 text-sm font-black text-[#183e57]">
              <FileSearch className="h-4 w-4" /> Campos encontrados ({groups.length})
            </h3>
            <p className="mt-1 text-xs text-[#627d8e]">
              Marque apenas o valor conferido. Você poderá corrigir os campos no formulário antes de
              salvar.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {groups.map(([field, items]) => (
                <div key={field} className="rounded-xl border border-[#d8e5eb] p-3">
                  <strong className="text-xs text-[#173d5b]">{items[0].label}</strong>
                  {items.length > 1 ? (
                    <p className="mt-1 text-[11px] font-semibold text-amber-700">
                      Confira os valores encontrados em páginas diferentes.
                    </p>
                  ) : null}
                  <label className="mt-2 flex items-start gap-2 text-xs text-[#516b7d]">
                    <input
                      type="radio"
                      name={`pdf-${field}`}
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
                        name={`pdf-${field}`}
                        checked={chosen[field] === item.id}
                        onChange={() => setChosen((current) => ({ ...current, [field]: item.id }))}
                      />
                      <span className="min-w-0 break-words">
                        <span className="block font-semibold">{item.value}</span>
                        <span className="block text-[11px] text-[#698294]">
                          {item.source} · página {item.page} ·{" "}
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
      </div>
      {photos.length ? (
        <section className="rounded-2xl border border-[#c8dce5] bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-[#183e57]">
                Imagens encontradas no PDF ({photos.length})
              </h3>
              <p className="mt-1 text-xs text-[#627d8e]">
                {photoChoice
                  ? "Confira a imagem e a finalidade selecionadas. A página de origem será registrada na revisão."
                  : "Selecione uma imagem e a finalidade. Nenhuma imagem será importada sem uma escolha explícita."}
              </p>
            </div>
            {photoChoice ? (
              <button
                type="button"
                className="text-xs font-bold text-[#6b4bd6] underline"
                onClick={() => setPhotoChoice(null)}
              >
                Não importar foto
              </button>
            ) : null}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className={`rounded-xl border p-2 ${
                  photoChoice?.id === photo.id
                    ? "border-[#7d5eea] bg-[#f8f5ff]"
                    : "border-[#d8e5eb] bg-[#f8fafb]"
                }`}
              >
                <button
                  type="button"
                  className="block w-full text-left"
                  onClick={() =>
                    setPhotoChoice((current) => ({
                      id: photo.id,
                      target: current?.id === photo.id ? current.target : "perfil",
                    }))
                  }
                >
                  <img
                    src={photo.previewUrl}
                    alt={`Imagem extraída da página ${photo.page}`}
                    className="h-40 w-full rounded-lg bg-white object-contain"
                  />
                  <span className="mt-2 block text-xs font-semibold text-[#183e57]">
                    Página {photo.page} · {photo.width} × {photo.height}px
                  </span>
                </button>
                {photoChoice?.id === photo.id ? (
                  <div className="mt-2 flex gap-3 text-xs font-semibold text-[#365b70]">
                    {(["perfil", "relatorio"] as const).map((target) => (
                      <label key={target} className="flex items-center gap-1">
                        <input
                          type="radio"
                          name="pdf-photo-target"
                          checked={photoChoice.target === target}
                          onChange={() => setPhotoChoice({ id: photo.id, target })}
                        />
                        {target === "perfil" ? "Foto de perfil" : "Foto do relatório"}
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {fileName && !photos.length && !photoError ? (
        <p className="rounded-xl border border-[#d8e5eb] bg-white p-3 text-xs text-[#627d8e]">
          Nenhuma imagem incorporada foi encontrada neste PDF.
        </p>
      ) : null}
      {photoError ? (
        <p
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950"
        >
          Texto lido, mas as imagens não puderam ser extraídas: {photoError}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-between gap-3">
        <button type="button" onClick={onBack} className="nexo-action-secondary">
          Voltar
        </button>
        <button
          type="button"
          disabled={!sourceFile || !pageCount || busy}
          onClick={() =>
            onApply(
              candidates.filter((item) => chosen[item.field] === item.id),
              fileName,
              photoChoice
                ? (() => {
                    const candidate = photos.find((photo) => photo.id === photoChoice.id);
                    return candidate ? { candidate, target: photoChoice.target } : null;
                  })()
                : null,
              sourceFile!,
              pageCount!,
              ocrStatus,
            )
          }
          className="nexo-action-primary disabled:opacity-40"
        >
          Revisar no cadastro
        </button>
      </div>
    </div>
  );
}
