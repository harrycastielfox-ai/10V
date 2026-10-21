import type { NexoPessoaInput, NexoPdfSourceInput } from "./nexoTypes";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { getDocument, GlobalWorkerOptions, OPS } from "pdfjs-dist";

export type NexoPdfField =
  | "nome"
  | "cpf"
  | "rg"
  | "data_nascimento"
  | "nome_mae"
  | "nome_pai"
  | "sexo"
  | "estado_civil"
  | "naturalidade"
  | "profissao"
  | "escolaridade"
  | "altura_cm"
  | "telefone"
  | "endereco.logradouro"
  | "endereco.numero"
  | "endereco.bairro"
  | "endereco.municipio"
  | "endereco.uf"
  | "documento.cnh"
  | "documento.renach";

export interface NexoPdfTextCell {
  text: string;
  x: number;
  y: number;
  width: number;
}
export interface NexoPdfTextPage {
  page: number;
  cells: NexoPdfTextCell[];
}
export interface NexoPdfCandidate {
  id: string;
  field: NexoPdfField;
  label: string;
  value: string;
  page: number;
  source: string;
  confidence: "alta" | "revisar";
}

export interface NexoPdfPhotoCandidate {
  id: string;
  page: number;
  width: number;
  height: number;
  file: File;
  previewUrl: string;
}

export type NexoPdfPhotoTarget = "perfil" | "relatorio";

export interface NexoPdfPhotoSelection {
  candidate: NexoPdfPhotoCandidate;
  target: NexoPdfPhotoTarget;
}

/** Applies the reviewed PDF image choice without making an image implicit. */
export function applyNexoPdfPhotoSelection(
  person: NexoPessoaInput,
  selection: NexoPdfPhotoSelection | null,
): NexoPessoaInput {
  if (!selection) return person;

  const next = { ...person };
  if (selection.target === "perfil") {
    next.foto_perfil = selection.candidate.file;
    next.foto_relatorio = selection.candidate.file;
  } else {
    next.foto_relatorio = selection.candidate.file;
  }
  next.observacoes = [
    next.observacoes.trim(),
    `Imagem extraída da página ${selection.candidate.page} do PDF e selecionada como foto de ${selection.target}.`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return next;
}

const labels: Record<string, { field: NexoPdfField; label: string }> = {
  nome: { field: "nome", label: "Nome completo" },
  cpf: { field: "cpf", label: "CPF" },
  rg: { field: "rg", label: "RG" },
  "data de nascimento": { field: "data_nascimento", label: "Data de nascimento" },
  "nome da mae": { field: "nome_mae", label: "Nome da mãe" },
  "nome do pai": { field: "nome_pai", label: "Nome do pai" },
  sexo: { field: "sexo", label: "Sexo" },
  "estado civil": { field: "estado_civil", label: "Estado civil" },
  naturalidade: { field: "naturalidade", label: "Naturalidade" },
  profissao: { field: "profissao", label: "Profissão" },
  escolaridade: { field: "escolaridade", label: "Escolaridade" },
  altura: { field: "altura_cm", label: "Altura (cm)" },
  telefone: { field: "telefone", label: "Telefone" },
  endereco: { field: "endereco.logradouro", label: "Endereço" },
  logradouro: { field: "endereco.logradouro", label: "Logradouro" },
  numero: { field: "endereco.numero", label: "Número" },
  bairro: { field: "endereco.bairro", label: "Bairro" },
  cidade: { field: "endereco.municipio", label: "Município" },
  municipio: { field: "endereco.municipio", label: "Município" },
  estado: { field: "endereco.uf", label: "UF" },
  uf: { field: "endereco.uf", label: "UF" },
  cnh: { field: "documento.cnh", label: "CNH" },
  renach: { field: "documento.renach", label: "Renach" },
};

const sourceFor = (text: string) => {
  const normalized = normalize(text);
  if (normalized.includes("senatran")) return "SENATRAN";
  if (normalized.includes("receita federal")) return "Receita Federal";
  if (normalized.includes("nimba")) return "NIMBA";
  if (normalized.includes("sigip")) return "SIGIP";
  if (normalized.includes("renavam")) return "RENAVAM";
  return "Fonte não identificada";
};

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[:.]+$/, "");
}

function meaningful(text: string) {
  const clean = text
    .trim()
    .replace(/^\[|\]$/g, "")
    .trim();
  return clean && !/^(?:-|null|nao consta|nao informado|n\/a|\[\s*\])$/i.test(normalize(clean))
    ? clean
    : null;
}

function dateISO(text: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const date = new Date(`${iso}T12:00:00Z`);
  return date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() + 1 === Number(month) &&
    date.getUTCDate() === Number(day)
    ? iso
    : null;
}

function acceptableValue(field: NexoPdfField, value: string) {
  const digits = value.replace(/\D/g, "");
  if (field === "cpf") return digits.length === 11;
  if (field === "rg") return digits.length >= 4 && digits.length <= 15;
  if (field === "sexo") return /^(?:m|f|masculino|feminino|outro|não binário)$/i.test(value);
  if (field === "documento.cnh" || field === "documento.renach")
    return digits.length >= 8 && digits.length <= 14;
  if (field === "endereco.logradouro") return value.length > 3 && value.split(/\s+/).length >= 2;
  if (field === "nome" || field === "nome_mae" || field === "nome_pai")
    return value.length >= 5 && !/\d/.test(value);
  return true;
}

function rowsOnPage(cells: NexoPdfTextCell[]) {
  const rows: NexoPdfTextCell[][] = [];
  for (const cell of [...cells]
    .filter((item) => item.text.trim())
    .sort((a, b) => b.y - a.y || a.x - b.x)) {
    const row = rows.find((items) => Math.abs(items[0].y - cell.y) < 2.5);
    if (row) row.push(cell);
    else rows.push([cell]);
  }
  return rows.map((row) => row.sort((a, b) => a.x - b.x));
}

function validatePdfFile(file: File) {
  if (!file.name.toLowerCase().endsWith(".pdf") || file.size > 15 * 1024 * 1024)
    throw new Error("Selecione um PDF de até 15 MB.");
}

async function openPdf(file: File) {
  validatePdfFile(file);
  GlobalWorkerOptions.workerSrc = workerSrc;
  return getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
}

async function destroyPdf(pdf: unknown) {
  const destroy = (pdf as { destroy?: () => Promise<void> }).destroy;
  await destroy?.();
}

/** Suggestions only. A human must choose values before the normal person form can save. */
export function suggestNexoPdfFields(pages: NexoPdfTextPage[]): NexoPdfCandidate[] {
  const candidates: NexoPdfCandidate[] = [];
  for (const page of pages) {
    const rows = rowsOnPage(page.cells);
    const source = sourceFor(page.cells.map((cell) => cell.text).join(" "));
    if (source === "SIGIP" || source === "RENAVAM") continue; // These pages describe events or vehicles.
    for (let rowIndex = 0; rowIndex < rows.length - 1; rowIndex++) {
      const row = rows[rowIndex];
      const next = rows[rowIndex + 1];
      if (row[0].y - next[0].y > 45) continue;
      const found = row
        .map((cell) => ({ cell, mapping: labels[normalize(cell.text)] }))
        .filter((item) => item.mapping);
      if (!found.length) continue;
      for (let index = 0; index < found.length; index++) {
        const { cell, mapping } = found[index];
        if (
          source === "SENATRAN" &&
          ![
            "nome",
            "cpf",
            "data_nascimento",
            "nome_mae",
            "nome_pai",
            "documento.cnh",
            "documento.renach",
          ].includes(mapping.field)
        )
          continue;
        const left = index === 0 ? -Infinity : (found[index - 1].cell.x + cell.x) / 2;
        const right =
          index === found.length - 1 ? Infinity : (cell.x + found[index + 1].cell.x) / 2;
        const raw = meaningful(
          next
            .filter((item) => item.x + item.width / 2 >= left && item.x + item.width / 2 < right)
            .map((item) => item.text)
            .join(" "),
        );
        if (!raw || labels[normalize(raw)]) continue;
        let value = raw;
        if (mapping.field === "data_nascimento") {
          const parsed = dateISO(raw);
          if (!parsed) continue;
          value = parsed;
        }
        if (mapping.field === "altura_cm") {
          const number = Number(raw.replace(/\s*cm$/i, "").replace(",", "."));
          if (number < 80 || number > 250) continue;
          value = String(number);
        }
        if (mapping.field === "endereco.uf" && !/^[A-Z]{2}$/.test(raw.trim())) continue;
        if (!acceptableValue(mapping.field, value)) continue;
        candidates.push({
          id: `${page.page}:${rowIndex}:${mapping.field}`,
          field: mapping.field,
          label: mapping.label,
          value,
          page: page.page,
          source,
          confidence:
            source === "Fonte não identificada" ||
            mapping.field.startsWith("endereco.") ||
            mapping.field === "telefone" ||
            mapping.field === "rg"
              ? "revisar"
              : "alta",
        });
      }
    }
    // NIMBA presents both parents in a single bracketed "Filiação" cell; order needs review.
    if (source === "NIMBA") {
      const index = rows.findIndex((row) =>
        row.some((cell) => normalize(cell.text) === "filiacao"),
      );
      const raw = index >= 0 ? rows[index + 1]?.map((cell) => cell.text).join(" ") : "";
      const parts = /^\[?\s*([^,[\]]+),\s*([^,[\]]+)\s*\]?$/.exec(raw?.trim() || "");
      if (parts)
        for (const [offset, field, label] of [
          [1, "nome_mae", "Nome da mãe"],
          [2, "nome_pai", "Nome do pai"],
        ] as const) {
          const value = meaningful(parts[offset]);
          if (value)
            candidates.push({
              id: `${page.page}:filiacao:${field}`,
              field,
              label,
              value,
              page: page.page,
              source,
              confidence: "revisar",
            });
        }
    }
  }
  return candidates;
}

export function defaultNexoPdfSelections(candidates: NexoPdfCandidate[]) {
  const selections: Partial<Record<NexoPdfField, string>> = {};
  for (const item of candidates) {
    const sameField = candidates.filter((other) => other.field === item.field);
    if (
      item.confidence === "alta" &&
      sameField.every((other) => other.value === item.value) &&
      !selections[item.field]
    ) {
      selections[item.field] = item.id;
    }
  }
  return selections;
}

export async function readNexoPdf(file: File): Promise<NexoPdfCandidate[]> {
  const pdf = await openPdf(file);
  try {
    if (pdf.numPages > 30)
      throw new Error("O PDF tem mais de 30 páginas; divida-o antes de importar.");
    const pages: NexoPdfTextPage[] = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      pages.push({
        page: number,
        cells: content.items
          .filter((item): item is Extract<typeof item, { str: string }> => "str" in item)
          .map((item) => ({
            text: item.str,
            x: item.transform[4],
            y: item.transform[5],
            width: item.width,
          })),
      });
    }
    if (!pages.some((page) => page.cells.some((cell) => cell.text.trim())))
      throw new Error(
        "Este PDF não contém texto selecionável. A leitura de imagens digitalizadas exigirá OCR.",
      );
    return suggestNexoPdfFields(pages);
  } finally {
    await destroyPdf(pdf);
  }
}

export async function readNexoPdfPageCount(file: File) {
  const pdf = await openPdf(file);
  try {
    if (pdf.numPages > 30)
      throw new Error("O PDF tem mais de 30 páginas; divida-o antes de importar.");
    return pdf.numPages;
  } finally {
    await destroyPdf(pdf);
  }
}

/** Runs OCR locally for image-only PDFs. No page image is sent to a remote service. */
export async function readNexoPdfWithOcr(file: File): Promise<NexoPdfCandidate[]> {
  const pdf = await openPdf(file);
  let worker: Awaited<ReturnType<(typeof import("tesseract.js"))["createWorker"]>> | null = null;
  try {
    const { createWorker } = await import("tesseract.js");
    worker = await createWorker("por+eng", undefined, {
      langPath: "https://tessdata.projectnaptha.com/4.0.0",
      logger: () => undefined,
    });
    if (pdf.numPages > 30)
      throw new Error("O PDF tem mais de 30 páginas; divida-o antes de importar.");
    const pages: NexoPdfTextPage[] = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const scale = 1.75;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({
        canvas,
        canvasContext: canvas.getContext("2d")!,
        viewport,
      }).promise;
      const result = await worker.recognize(canvas);
      const lines = (result.data.blocks ?? [])
        .flatMap((block) => block.paragraphs)
        .flatMap((paragraph) => paragraph.lines)
        .filter((line) => line.text.trim());
      pages.push({
        page: number,
        cells: lines.map((line) => ({
          text: line.text.trim(),
          x: line.bbox.x0 / scale,
          y: (viewport.height - line.bbox.y1) / scale,
          width: (line.bbox.x1 - line.bbox.x0) / scale,
        })),
      });
    }
    return suggestNexoPdfFields(pages);
  } finally {
    if (worker) await worker.terminate();
    await destroyPdf(pdf);
  }
}

/** Extract embedded images without uploading or persisting the source PDF. */
export async function readNexoPdfPhotos(file: File): Promise<NexoPdfPhotoCandidate[]> {
  const pdf = await openPdf(file);
  try {
    if (pdf.numPages > 30)
      throw new Error("O PDF tem mais de 30 páginas; divida-o antes de importar.");
    const photos: NexoPdfPhotoCandidate[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const operatorList = await page.getOperatorList();
      const imageOps: { id: string; matrix: number[] }[] = [];
      let lastTransform: number[] | null = null;
      for (let index = 0; index < operatorList.fnArray.length; index++) {
        const args = operatorList.argsArray[index];
        if (operatorList.fnArray[index] === OPS.transform && args && args.length >= 6) {
          lastTransform = Array.from(args.slice(0, 6), Number);
        }
        const operation = operatorList.fnArray[index];
        const isImageOperation =
          operation === OPS.paintImageXObject ||
          operation === OPS.paintImageXObjectRepeat ||
          operation === OPS.paintInlineImageXObject;
        if (!isImageOperation || !lastTransform) continue;
        const imageId = args?.[0];
        imageOps.push({
          id: typeof imageId === "string" ? imageId : `inline-${index}`,
          matrix: lastTransform,
        });
      }
      if (!imageOps.length) continue;

      const baseViewport = page.getViewport({ scale: 1 });
      const renderScale = 2;
      const viewport = page.getViewport({ scale: renderScale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({
        canvas,
        canvasContext: canvas.getContext("2d")!,
        viewport,
      }).promise;

      let imageIndex = 0;
      const seen = new Set<string>();
      for (const { id: imageId, matrix } of imageOps) {
        const [a, b, c, d, e, f] = matrix;
        const width = Math.hypot(a, b);
        const height = Math.hypot(c, d);
        const key = `${imageId}:${matrix.join(",")}`;
        if (seen.has(key)) continue;
        seen.add(key);
        // Full-page raster backgrounds are document scans, not person photos.
        if (
          width < 80 ||
          height < 80 ||
          (width >= baseViewport.width * 0.8 && height >= baseViewport.height * 0.8)
        )
          continue;
        const padding = 2 * renderScale;
        const sourceX = Math.max(0, Math.floor(e * renderScale - padding));
        const sourceY = Math.max(
          0,
          Math.floor((baseViewport.height - f - height) * renderScale - padding),
        );
        const sourceWidth = Math.min(
          canvas.width - sourceX,
          Math.ceil(width * renderScale + padding * 2),
        );
        const sourceHeight = Math.min(
          canvas.height - sourceY,
          Math.ceil(height * renderScale + padding * 2),
        );
        if (sourceWidth <= 0 || sourceHeight <= 0) continue;
        const photoCanvas = document.createElement("canvas");
        photoCanvas.width = sourceWidth;
        photoCanvas.height = sourceHeight;
        photoCanvas
          .getContext("2d")!
          .drawImage(
            canvas,
            sourceX,
            sourceY,
            sourceWidth,
            sourceHeight,
            0,
            0,
            sourceWidth,
            sourceHeight,
          );
        const blob = await new Promise<Blob>((resolve, reject) =>
          photoCanvas.toBlob(
            (value) =>
              value
                ? resolve(value)
                : reject(new Error("Não foi possível preparar a imagem do PDF.")),
            "image/png",
          ),
        );
        const fileName = `${file.name.replace(/\.pdf$/i, "")}-pagina-${pageNumber}-imagem-${imageIndex + 1}.png`;
        const imageFile = new File([blob], fileName, { type: "image/png" });
        photos.push({
          id: `${pageNumber}:${imageId}`,
          page: pageNumber,
          width,
          height,
          file: imageFile,
          previewUrl: URL.createObjectURL(imageFile),
        });
        imageIndex += 1;
      }
    }
    return photos;
  } finally {
    await destroyPdf(pdf);
  }
}

export function applyNexoPdfCandidates(
  person: NexoPessoaInput,
  selected: NexoPdfCandidate[],
  fileName: string,
): NexoPessoaInput {
  const next = {
    ...person,
    endereco: { ...person.endereco },
    documentos_extras: [...person.documentos_extras],
  };
  for (const item of selected) {
    if (item.field.startsWith("endereco.")) {
      const key = item.field.slice("endereco.".length) as
        "logradouro" | "numero" | "bairro" | "municipio" | "uf";
      next.endereco[key] = item.value;
    } else if (item.field === "documento.cnh" || item.field === "documento.renach") {
      const type = item.field === "documento.cnh" ? "CNH" : "Renach";
      if (!next.documentos_extras.some((doc) => doc.tipo === type && doc.numero === item.value))
        next.documentos_extras.push({ id: crypto.randomUUID(), tipo: type, numero: item.value });
    } else if (item.field === "altura_cm") next.altura_cm = Number(item.value);
    else {
      const key = item.field as Exclude<
        NexoPdfField,
        `endereco.${string}` | `documento.${string}` | "altura_cm"
      >;
      next[key] = item.value;
    }
  }
  const sources = [...new Set(selected.map((item) => item.source))];
  const pages = [...new Set(selected.map((item) => item.page))].sort((a, b) => a - b);
  const pageLabel = pages.length ? pages.join(", ") : "não informadas";
  const reference = selected.length
    ? `Importação revisada do PDF "${fileName}": ${selected.length} campo(s) confirmado(s); fonte(s): ${sources.join(", ")}; página(s): ${pageLabel}.`
    : `PDF anexado para conferência: "${fileName}".`;
  next.observacoes = [person.observacoes.trim(), reference].filter(Boolean).join("\n\n");
  next.fonte_resumo = [
    person.fonte_resumo.trim(),
    `PDF textual: ${fileName}; ${[...new Set(selected.map((item) => item.source))].join(", ")}. O original será preservado com hash após o salvamento.`,
  ]
    .filter(Boolean)
    .join("\n");
  return next;
}

/** Applies reviewed candidates from several source PDFs without changing field precedence. */
export function applyNexoPdfSources(
  person: NexoPessoaInput,
  sources: NexoPdfSourceInput[],
): NexoPessoaInput {
  let next = person;
  for (const source of sources) {
    next = applyNexoPdfCandidates(
      next,
      source.candidates.map((candidate, index) => ({
        ...candidate,
        id: source.file.name + ":" + index,
        field: candidate.field as NexoPdfField,
      })),
      source.file.name,
    );
  }
  next.pdf_fontes = sources;
  next.pdf_fonte = sources[0] || null;
  return next;
}
