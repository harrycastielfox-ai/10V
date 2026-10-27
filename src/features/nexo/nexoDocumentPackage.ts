import {
  listNexoReportObservations,
  selectedNexoReportPhotos,
  selectedNexoReportSources,
  selectNexoReportData,
  type NexoReportConfig,
  type NexoReportData,
} from "./nexoReportConfig";
import type { NexoReportScope } from "./nexoTypes";

export interface NexoDocumentPackageEntry {
  path: string;
  kind: "pdf" | "foto";
  sourceKey: string;
  storagePath: string | null;
  url: string | null;
  status: "disponivel" | "somente-referencia";
}

export interface NexoDocumentPackageManifest {
  format: "nexo-document-package";
  version: 1;
  generatedAt: string;
  scope: NexoReportScope;
  people: Array<{ id: string; nome: string }>;
  observations: Array<{ key: string; title: string; content: string }>;
  entries: NexoDocumentPackageEntry[];
  notes: string[];
}

function safeFilename(value: string, fallback: string) {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || fallback;
}

export function buildNexoDocumentPackage(
  scope: NexoReportScope,
  data: NexoReportData,
  config: NexoReportConfig,
  generatedAt = new Date().toISOString(),
): NexoDocumentPackageManifest {
  const selected = selectNexoReportData(scope, data);
  const entries: NexoDocumentPackageEntry[] = [];
  const usedPaths = new Set<string>();
  const uniquePath = (candidate: string) => {
    if (!usedPaths.has(candidate)) {
      usedPaths.add(candidate);
      return candidate;
    }
    const extensionIndex = candidate.lastIndexOf(".");
    const stem = extensionIndex > 0 ? candidate.slice(0, extensionIndex) : candidate;
    const extension = extensionIndex > 0 ? candidate.slice(extensionIndex) : "";
    let suffix = 2;
    let next = `${stem}-${suffix}${extension}`;
    while (usedPaths.has(next)) {
      suffix += 1;
      next = `${stem}-${suffix}${extension}`;
    }
    usedPaths.add(next);
    return next;
  };
  for (const person of selected.people) {
    for (const source of selectedNexoReportSources(person, config)) {
      const extension = source.kind === "recurso" ? "pdf" : "pdf";
      entries.push({
        path: uniquePath(
          `documentos/${safeFilename(person.nome, person.id)}/${safeFilename(source.filename, `${source.key}.${extension}`)}`,
        ),
        kind: "pdf",
        sourceKey: source.key,
        storagePath: source.storagePath,
        url: source.url,
        status: source.url ? "disponivel" : "somente-referencia",
      });
    }
    for (const photo of selectedNexoReportPhotos(person, config)) {
      entries.push({
        path: uniquePath(
          `fotografias/${safeFilename(person.nome, person.id)}/${safeFilename(photo.key, "foto")}.jpg`,
        ),
        kind: "foto",
        sourceKey: photo.key,
        storagePath: null,
        url: photo.url,
        status: photo.url ? "disponivel" : "somente-referencia",
      });
    }
  }
  return {
    format: "nexo-document-package",
    version: 1,
    generatedAt,
    scope,
    people: selected.people.map((person) => ({ id: person.id, nome: person.nome })),
    observations: listNexoReportObservations(scope, data).filter(
      (entry) => !config.excludedObservationKeys.includes(entry.key),
    ),
    entries,
    notes: [
      "O índice preserva a seleção feita no configurador e a origem de cada item.",
      "Documentos sem URL assinada permanecem como referência por segurança; o arquivo original continua no Storage privado.",
      "O pacote não altera nem remove cadastros, fotos ou documentos do NEXO.",
    ],
  };
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true);
}

export function serializeNexoDocumentPackageManifest(
  manifest: NexoDocumentPackageManifest,
  failedPaths: readonly string[] = [],
  downloadedPaths: readonly string[] = [],
) {
  const failed = new Set(failedPaths);
  const downloaded = new Set(downloadedPaths);
  return JSON.stringify(
    {
      ...manifest,
      entries: manifest.entries.map(({ url: _url, storagePath: _storagePath, ...entry }) => ({
        ...entry,
        status: failed.has(entry.path)
          ? ("somente-referencia" as const)
          : downloaded.has(entry.path)
            ? ("disponivel" as const)
            : entry.status,
      })),
      notes: failed.size
        ? [
            ...manifest.notes,
            `Não foi possível baixar ${failed.size} item(ns): ${[...failed].join(", ")}`,
          ]
        : manifest.notes,
    },
    null,
    2,
  );
}

export async function downloadNexoDocumentPackage(
  manifest: NexoDocumentPackageManifest,
  resolvePrivateUrl?: (storagePath: string) => Promise<string | null>,
) {
  const encoder = new TextEncoder();
  const files: Array<{ path: string; bytes: Uint8Array }> = [
    { path: "manifest.json", bytes: new Uint8Array() },
    {
      path: "LEIA-ME.txt",
      bytes: encoder.encode(
        "Pacote documental NEXO\r\n\r\nConsulte manifest.json para a seleção, origem, hash e disponibilidade de cada item.\r\n",
      ),
    },
  ];
  const failed: string[] = [];
  const downloaded: string[] = [];
  for (const entry of manifest.entries) {
    try {
      const url =
        entry.url ??
        (entry.storagePath && resolvePrivateUrl
          ? await resolvePrivateUrl(entry.storagePath)
          : null);
      if (!url) continue;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      files.push({ path: entry.path, bytes: new Uint8Array(await response.arrayBuffer()) });
      downloaded.push(entry.path);
    } catch {
      failed.push(entry.path);
    }
  }
  files[0] = {
    path: "manifest.json",
    bytes: encoder.encode(serializeNexoDocumentPackageManifest(manifest, failed, downloaded)),
  };
  const blob = new Blob([await createStoredZip(files)], { type: "application/zip" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `nexo-pacote-documental-${manifest.generatedAt.slice(0, 10)}.zip`;
  link.click();
  URL.revokeObjectURL(link.href);
  return { downloaded: files.length - 2, failed: failed.length };
}

async function createStoredZip(files: Array<{ path: string; bytes: Uint8Array }>) {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.path);
    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    writeUint32(localView, 0, 0x04034b50);
    localView.setUint16(4, 20, true);
    localView.setUint16(8, 0, true);
    localView.setUint32(14, crc32(file.bytes), true);
    localView.setUint32(18, file.bytes.length, true);
    localView.setUint32(22, file.bytes.length, true);
    localView.setUint16(26, name.length, true);
    local.set(name, 30);
    localParts.push(local, file.bytes);
    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    writeUint32(centralView, 0, 0x02014b50);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint32(16, crc32(file.bytes), true);
    centralView.setUint32(20, file.bytes.length, true);
    centralView.setUint32(24, file.bytes.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true);
    central.set(name, 46);
    centralParts.push(central);
    offset += local.length + file.bytes.length;
  }
  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  writeUint32(endView, 0, 0x06054b50);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  const output = new Uint8Array(offset + centralSize + end.length);
  let cursor = 0;
  for (const part of [...localParts, ...centralParts, end]) {
    output.set(part, cursor);
    cursor += part.length;
  }
  return output.buffer;
}
