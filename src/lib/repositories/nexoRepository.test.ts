import { beforeEach, describe, expect, it, vi } from "vitest";
import { NEXO_DEMO_PESSOAS } from "@/features/nexo/nexoDemoData";
import type { NexoPessoaInput } from "@/features/nexo/nexoTypes";

const state = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  storageFrom: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: state.from,
    rpc: state.rpc,
    storage: { from: state.storageFrom },
  },
}));

const {
  createNexoPessoa,
  updateNexoPessoa,
  softDeleteNexoTerritorio,
  softDeleteNexoVeiculoVinculo,
} = await import("./nexoRepository");

const person = { ...NEXO_DEMO_PESSOAS[0], updated_at: "2026-10-20T12:00:00.000Z" };
const historic = { ...person.vinculos[0], id: "past-link", status: "desvinculado" as const };
const active = {
  ...person.vinculos[0],
  id: "active-link",
  organizacao_id: "current-organization",
  status: "confirmado" as const,
};
const input: NexoPessoaInput = {
  nome: person.nome,
  apelido: "",
  cpf: "",
  rg: "",
  data_nascimento: "",
  naturalidade: "",
  nome_mae: "",
  nome_pai: "",
  nome_social: "",
  sexo: "",
  raca_cor: "",
  estado_civil: "",
  nacionalidade: "Brasileira",
  escolaridade: "",
  profissao: "",
  idade_aproximada: false,
  idade_aproximada_valor: null,
  em_situacao_rua: false,
  usa_tornozeleira: false,
  altura_cm: null,
  tipo_fisico: "",
  estado_aparente: "",
  sinais_particulares: "",
  documentos_extras: [],
  contatos: [],
  telefone: "",
  observacoes: "",
  endereco: {
    logradouro: "",
    numero: "",
    bairro: "",
    municipio: "Itabela",
    uf: "BA",
    ponto_referencia: "",
    como_chegar: "",
    link_navegacao: "",
    latitude: null,
    longitude: null,
  },
  organizacao_id: active.organizacao_id,
  usar_local_faccao: false,
  vinculo_status: "confirmado",
  vinculo_funcao: "Integrante",
  vinculo_confianca: 50,
  fonte_resumo: "Atualização",
  foto_perfil: null,
  foto_relatorio: null,
  pdf_fonte: null,
};

describe("NEXO persistence regressions", () => {
  beforeEach(() => {
    state.from.mockReset();
    state.update.mockReset().mockReturnThis();
    state.upload.mockReset().mockResolvedValue({ data: { path: "new-photo" }, error: null });
    state.remove.mockReset().mockResolvedValue({ data: [], error: null });
    state.storageFrom.mockReset().mockReturnValue({
      upload: state.upload,
      remove: state.remove,
    });
    state.rpc.mockReset().mockReturnValue({
      abortSignal: vi.fn().mockReturnThis(),
      then: (resolve: (result: unknown) => unknown) =>
        Promise.resolve({ data: true, error: null }).then(resolve),
    });
    const builder = {
      update: state.update,
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      then: (resolve: (result: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(resolve),
    };
    state.from.mockReturnValue(builder);
  });

  it("sends a stable request id and the whole civil profile in the atomic creation", async () => {
    state.rpc.mockReturnValueOnce({
      abortSignal: vi.fn().mockReturnThis(),
      then: (resolve: (result: unknown) => unknown) =>
        Promise.resolve({ data: "created-person", error: null }).then(resolve),
    });

    await expect(
      createNexoPessoa(
        {
          ...input,
          nome_social: "Nome social",
          altura_cm: 175,
          usa_tornozeleira: true,
        },
        "creation-request",
      ),
    ).resolves.toEqual({ personId: "created-person", photoPending: false, documentPending: false });

    expect(state.rpc).toHaveBeenCalledWith(
      "nexo_criar_pessoa_completa",
      expect.objectContaining({
        p_payload: expect.objectContaining({
          request_id: "creation-request",
          pessoa: expect.objectContaining({
            nome_social: "Nome social",
            altura_cm: 175,
            usa_tornozeleira: true,
          }),
        }),
      }),
    );
  });

  it("keeps the created person and reports a recoverable pending photo when upload fails", async () => {
    state.rpc.mockReturnValueOnce({
      abortSignal: vi.fn().mockReturnThis(),
      then: (resolve: (result: unknown) => unknown) =>
        Promise.resolve({ data: "created-person", error: null }).then(resolve),
    });
    state.upload.mockResolvedValueOnce({ data: null, error: { message: "storage unavailable" } });

    await expect(
      createNexoPessoa(
        { ...input, foto_perfil: new File(["photo"], "profile.jpg", { type: "image/jpeg" }) },
        "creation-request",
      ),
    ).resolves.toEqual({ personId: "created-person", photoPending: true, documentPending: false });

    expect(state.rpc).toHaveBeenCalledWith("nexo_criar_pessoa_completa", expect.any(Object));
    expect(state.update).not.toHaveBeenCalled();
  });

  it("preserves the reviewed PDF source and selected claims", async () => {
    state.rpc.mockReturnValueOnce({
      abortSignal: vi.fn().mockReturnThis(),
      then: (resolve: (result: unknown) => unknown) =>
        Promise.resolve({ data: "created-person", error: null }).then(resolve),
    });
    const documentBuilder = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "source-id" }, error: null }),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };
    const claimsBuilder = {
      insert: vi.fn().mockResolvedValue({ error: null }),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };
    state.from.mockImplementation((table: string) =>
      table === "nexo_documentos_fontes" ? documentBuilder : claimsBuilder,
    );

    const source = new File(["%PDF-1.7\nsource"], "origem.pdf", { type: "application/pdf" });
    await expect(
      createNexoPessoa(
        {
          ...input,
          pdf_fonte: {
            file: source,
            page_count: 2,
            ocr_status: "nao_aplicado",
            candidates: [
              {
                field: "nome",
                label: "Nome completo",
                value: "Pessoa Teste",
                page: 1,
                source: "NIMBA",
                confidence: "alta",
              },
            ],
          },
        },
        "creation-request",
      ),
    ).resolves.toMatchObject({ personId: "created-person", documentPending: false });

    expect(state.upload).toHaveBeenCalledWith(
      expect.stringContaining("pessoas/created-person/documentos/"),
      source,
      expect.objectContaining({ contentType: "application/pdf" }),
    );
    expect(documentBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        pessoa_id: "created-person",
        original_filename: "origem.pdf",
        mime_type: "application/pdf",
        page_count: 2,
        sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    );
    expect(claimsBuilder.insert).toHaveBeenCalledWith([
      expect.objectContaining({ documento_id: "source-id", campo: "nome", estado: "aceito" }),
    ]);
  });

  it("sends the expected version and active membership in the atomic edit", async () => {
    await updateNexoPessoa({ ...person, vinculos: [historic, active] }, input);

    expect(state.rpc).toHaveBeenCalledWith(
      "nexo_atualizar_pessoa_completa",
      expect.objectContaining({
        p_pessoa_id: person.id,
        p_expected_updated_at: person.updated_at,
        p_payload: expect.objectContaining({
          pessoa: expect.objectContaining({ nome: person.nome }),
          vinculo: expect.objectContaining({
            organizacao_id: active.organizacao_id,
            status: "confirmado",
            funcao: "Integrante",
            superior_vinculo_id: active.superior_vinculo_id,
          }),
        }),
      }),
    );
    expect(state.from).not.toHaveBeenCalled();
  });

  it("clears the former superior when requesting an organization transfer", async () => {
    await updateNexoPessoa(
      { ...person, vinculos: [historic, active] },
      { ...input, organizacao_id: "next-organization" },
    );
    expect(state.rpc).toHaveBeenCalledWith(
      "nexo_atualizar_pessoa_completa",
      expect.objectContaining({
        p_payload: expect.objectContaining({
          vinculo: expect.objectContaining({
            organizacao_id: "next-organization",
            superior_vinculo_id: null,
          }),
        }),
      }),
    );
  });

  it("keeps historical memberships inactive when no organization is selected", async () => {
    await updateNexoPessoa({ ...person, vinculos: [historic] }, { ...input, organizacao_id: "" });
    expect(state.rpc).toHaveBeenCalledWith(
      "nexo_atualizar_pessoa_completa",
      expect.objectContaining({
        p_payload: expect.objectContaining({
          vinculo: expect.objectContaining({ organizacao_id: null }),
        }),
      }),
    );
    expect(state.from).not.toHaveBeenCalled();
  });

  it("requests reactivation when a past organization is explicitly selected", async () => {
    await updateNexoPessoa(
      { ...person, vinculos: [historic] },
      { ...input, organizacao_id: historic.organizacao_id },
    );
    expect(state.rpc).toHaveBeenCalledWith(
      "nexo_atualizar_pessoa_completa",
      expect.objectContaining({
        p_payload: expect.objectContaining({
          vinculo: expect.objectContaining({
            organizacao_id: historic.organizacao_id,
            status: "confirmado",
          }),
        }),
      }),
    );
    expect(state.from).not.toHaveBeenCalled();
  });

  it("requests an unlink inside the same atomic edit", async () => {
    await updateNexoPessoa(
      { ...person, vinculos: [historic, active] },
      { ...input, vinculo_status: "desvinculado" },
    );
    expect(state.rpc).toHaveBeenCalledWith(
      "nexo_atualizar_pessoa_completa",
      expect.objectContaining({
        p_payload: expect.objectContaining({
          vinculo: expect.objectContaining({ status: "desvinculado" }),
        }),
      }),
    );
  });

  it("turns a stale-version database error into an actionable edit conflict", async () => {
    state.rpc.mockReturnValueOnce({
      abortSignal: vi.fn().mockReturnThis(),
      then: (resolve: (result: unknown) => unknown) =>
        Promise.resolve({
          data: null,
          error: { message: "nexo_edicao_conflito", details: "A ficha mudou." },
        }).then(resolve),
    });

    await expect(updateNexoPessoa({ ...person, vinculos: [active] }, input)).rejects.toMatchObject({
      code: "NEXO_EDIT_CONFLICT",
      message: expect.stringContaining("outro operador"),
    });
    expect(state.from).not.toHaveBeenCalled();
  });

  it("keeps an atomic edit successful when its photo upload remains pending", async () => {
    state.upload.mockResolvedValueOnce({ data: null, error: { message: "storage unavailable" } });

    await expect(
      updateNexoPessoa(
        { ...person, vinculos: [active] },
        { ...input, foto_perfil: new File(["photo"], "profile.jpg", { type: "image/jpeg" }) },
      ),
    ).resolves.toEqual({ personId: person.id, photoPending: true, documentPending: false });

    expect(state.rpc).toHaveBeenCalledWith("nexo_atualizar_pessoa_completa", expect.any(Object));
    expect(state.update).not.toHaveBeenCalled();
  });

  it("attaches one photo to profile and report and cleans replaced objects", async () => {
    await expect(
      updateNexoPessoa(
        {
          ...person,
          foto_perfil_path: "pessoas/person/old-profile.jpg",
          foto_relatorio_path: "pessoas/person/old-report.jpg",
          vinculos: [active],
        },
        { ...input, foto_perfil: new File(["photo"], "profile.jpg", { type: "image/jpeg" }) },
      ),
    ).resolves.toEqual({ personId: person.id, photoPending: false, documentPending: false });

    const uploadedPath = String(state.upload.mock.calls[0]?.[0]);
    expect(state.update).toHaveBeenCalledWith({
      foto_perfil_path: uploadedPath,
      foto_relatorio_path: uploadedPath,
    });
    expect(state.remove).toHaveBeenCalledWith([
      "pessoas/person/old-profile.jpg",
      "pessoas/person/old-report.jpg",
    ]);
  });

  it("keeps a report-only photo out of the profile column", async () => {
    await expect(
      updateNexoPessoa(
        {
          ...person,
          foto_perfil_path: "pessoas/person/current-profile.jpg",
          foto_relatorio_path: "pessoas/person/old-report.jpg",
          vinculos: [active],
        },
        {
          ...input,
          foto_relatorio: new File(["report"], "report.jpg", { type: "image/jpeg" }),
        },
      ),
    ).resolves.toEqual({ personId: person.id, photoPending: false, documentPending: false });

    const uploadedPath = String(state.upload.mock.calls[0]?.[0]);
    expect(uploadedPath).toContain("/relatorio-");
    expect(state.update).toHaveBeenCalledWith({ foto_relatorio_path: uploadedPath });
    expect(state.remove).toHaveBeenCalledWith(["pessoas/person/old-report.jpg"]);
  });

  it("removes a new object when linking the uploaded photo to the person fails", async () => {
    state.from.mockReturnValueOnce({
      update: state.update,
      eq: vi.fn().mockReturnThis(),
      then: (resolve: (result: unknown) => unknown) =>
        Promise.resolve({ data: null, error: { message: "database unavailable" } }).then(resolve),
    });

    await expect(
      updateNexoPessoa(
        { ...person, vinculos: [active] },
        { ...input, foto_perfil: new File(["photo"], "profile.jpg", { type: "image/jpeg" }) },
      ),
    ).resolves.toEqual({ personId: person.id, photoPending: true, documentPending: false });

    const uploadedPath = String(state.upload.mock.calls[0]?.[0]);
    expect(state.remove).toHaveBeenCalledWith([uploadedPath]);
  });

  it.each([
    ["territory", softDeleteNexoTerritorio, "soft_delete_nexo_territorio", "p_territorio_id"],
    ["vehicle", softDeleteNexoVeiculoVinculo, "soft_delete_nexo_veiculo_vinculo", "p_vinculo_id"],
  ] as const)(
    "uses the RLS-preserving removal operation for %s",
    async (_kind, remove, rpc, field) => {
      await remove("target-id");
      expect(state.rpc).toHaveBeenCalledWith(rpc, { [field]: "target-id" });
      state.rpc.mockResolvedValueOnce({ data: false, error: null });
      await expect(remove("missing-id")).rejects.toThrow("já foi removido");
      expect(state.from).not.toHaveBeenCalled();
    },
  );
});
