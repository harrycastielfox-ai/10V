import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  uploadResults: [] as Array<{ error: unknown }>,
  removed: [] as string[][],
}));

vi.mock("@/features/objects/imageCompression", () => ({
  compressObjectImage: async () => new Blob(["imagem"], { type: "image/webp" }),
}));

vi.mock("@/lib/supabaseClient", () => {
  const table = {
    insert: () => table,
    select: () => table,
    abortSignal: () => table,
    single: async () => ({ data: { id: crypto.randomUUID() }, error: null }),
  };
  const bucket = {
    upload: async () => state.uploadResults.shift() ?? { error: null },
    remove: async (paths: string[]) => {
      state.removed.push(paths);
      return { error: null };
    },
  };
  return { supabase: { from: () => table, storage: { from: () => bucket } } };
});

const { uploadObjectPhotos } = await import("./objectsRepository");

function photo(name: string) {
  return new File(["conteudo"], name, { type: "image/jpeg" });
}

describe("uploadObjectPhotos", () => {
  beforeEach(() => {
    state.uploadResults = [];
    state.removed = [];
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("preserva o lote e devolve somente as fotografias que falharam", async () => {
    state.uploadResults = [{ error: null }, { error: null }, { error: new Error("rede") }];

    const result = await uploadObjectPhotos("objeto-1", [photo("a.jpg"), photo("b.jpg")]);

    expect(result.created).toHaveLength(1);
    expect(result.failed.map((file) => file.name)).toEqual(["b.jpg"]);
  });

  it("remove o original parcial quando o envio da miniatura falha", async () => {
    state.uploadResults = [{ error: null }, { error: new Error("rede") }];

    const result = await uploadObjectPhotos("objeto-1", [photo("a.jpg")]);

    expect(result.created).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(state.removed).toHaveLength(1);
    expect(state.removed[0]).toHaveLength(1);
    expect(state.removed[0][0]).toMatch(/^objeto-1\/.+\.webp$/);
  });
});
