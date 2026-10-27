import { describe, expect, it } from "vitest";
import { createNexoReportConfig } from "./nexoReportConfig";
import {
  buildNexoDocumentPackage,
  serializeNexoDocumentPackageManifest,
} from "./nexoDocumentPackage";
import { NEXO_DEMO_ORGANIZACOES, NEXO_DEMO_PESSOAS } from "./nexoDemoData";

describe("pacote documental NEXO", () => {
  it("preserva o recorte e identifica fontes e fotos selecionadas", () => {
    const person = {
      ...NEXO_DEMO_PESSOAS[0],
      foto_relatorio_url: "/principal.jpg",
      documentos_fontes: [
        {
          id: "fonte-1",
          pessoa_id: NEXO_DEMO_PESSOAS[0].id,
          storage_path: "pessoas/pessoa/fonte.pdf",
          original_filename: "fonte.pdf",
          mime_type: "application/pdf" as const,
          size_bytes: 1,
          sha256: "hash",
          page_count: 2,
          extractor_version: "v1",
          ocr_status: "concluido" as const,
          created_at: "2026-10-21T12:00:00Z",
        },
      ],
    };
    const config = createNexoReportConfig();
    const manifest = buildNexoDocumentPackage(
      { kind: "pessoa", pessoaId: person.id },
      { organizacoes: NEXO_DEMO_ORGANIZACOES, pessoas: [person] },
      config,
      "2026-10-21T13:00:00Z",
    );
    expect(manifest.format).toBe("nexo-document-package");
    expect(manifest.people).toEqual([{ id: person.id, nome: person.nome }]);
    expect(manifest.entries.map((entry) => entry.kind)).toEqual(["pdf", "foto"]);
    expect(manifest.entries[0].status).toBe("somente-referencia");
    expect(manifest.generatedAt).toBe("2026-10-21T13:00:00Z");
  });

  it("não inclui fotos quando a seção foi desmarcada", () => {
    const config = createNexoReportConfig();
    config.sections.photographs = false;
    const manifest = buildNexoDocumentPackage(
      { kind: "geral" },
      { organizacoes: NEXO_DEMO_ORGANIZACOES, pessoas: NEXO_DEMO_PESSOAS },
      config,
    );
    expect(manifest.entries.every((entry) => entry.kind !== "foto")).toBe(true);
  });

  it("não grava URLs assinadas nem caminhos privados no manifesto portátil", () => {
    const config = createNexoReportConfig();
    const manifest = buildNexoDocumentPackage(
      { kind: "geral" },
      { organizacoes: NEXO_DEMO_ORGANIZACOES, pessoas: NEXO_DEMO_PESSOAS },
      config,
    );
    manifest.entries[0] = {
      ...manifest.entries[0],
      storagePath: "pessoas/privado/origem.pdf",
      url: "http://127.0.0.1/storage/v1/object/sign/nexo-private/origem.pdf?token=secret",
      status: "disponivel",
    };

    const portable = serializeNexoDocumentPackageManifest(manifest);

    expect(portable).not.toContain("token=secret");
    expect(portable).not.toContain("pessoas/privado/origem.pdf");
    expect(JSON.parse(portable).entries[0]).toEqual(
      expect.objectContaining({ status: "disponivel" }),
    );
  });
});
