import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  uploadResults: [] as Array<{ error: unknown }>,
  removed: [] as string[][],
}));

vi.mock("@/features/vehicles/imageCompression", () => ({
  compressVehicleImage: async () => new Blob(["imagem"], { type: "image/webp" }),
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

const { uploadVehiclePhotos } = await import("./vehiclesRepository");

function photo(name: string) {
  return new File(["conteudo"], name, { type: "image/jpeg" });
}

describe("uploadVehiclePhotos", () => {
  beforeEach(() => {
    state.uploadResults = [];
    state.removed = [];
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("não derruba o lote: envia as demais e devolve só as que falharam", async () => {
    // 1ª foto: original e miniatura sobem. 2ª foto: o original falha.
    state.uploadResults = [{ error: null }, { error: null }, { error: new Error("rede") }];

    const result = await uploadVehiclePhotos("veiculo-1", [photo("a.jpg"), photo("b.jpg")]);

    expect(result.created).toHaveLength(1);
    expect(result.failed.map((file) => file.name)).toEqual(["b.jpg"]);
  });

  it("remove o que subiu pela metade quando a miniatura falha", async () => {
    state.uploadResults = [{ error: null }, { error: new Error("rede") }];

    const result = await uploadVehiclePhotos("veiculo-1", [photo("a.jpg")]);

    expect(result.created).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(state.removed).toHaveLength(1);
    expect(state.removed[0][0]).toContain("veiculo-1/");
  });
});
