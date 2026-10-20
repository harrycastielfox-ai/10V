import { beforeEach, describe, expect, it, vi } from "vitest";
import { NEXO_DEMO_PESSOAS } from "@/features/nexo/nexoDemoData";
import type { NexoPessoaInput } from "@/features/nexo/nexoTypes";

const state = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabaseClient", () => ({
  supabase: { from: state.from, rpc: state.rpc },
}));

const { updateNexoPessoa, softDeleteNexoTerritorio, softDeleteNexoVeiculoVinculo } =
  await import("./nexoRepository");

const person = NEXO_DEMO_PESSOAS[0];
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
};

describe("NEXO persistence regressions", () => {
  beforeEach(() => {
    state.from.mockReset();
    state.rpc.mockReset().mockResolvedValue({ data: true, error: null });
    const builder = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      then: (resolve: (result: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(resolve),
    };
    state.from.mockReturnValue(builder);
  });

  it("edits the active membership even when a former membership is returned first", async () => {
    await updateNexoPessoa({ ...person, vinculos: [historic, active] }, input);

    expect(state.rpc).toHaveBeenCalledWith(
      "nexo_gerenciar_vinculo",
      expect.objectContaining({
        p_vinculo_id: active.id,
        p_acao: "atualizar",
        p_funcao: "Integrante",
      }),
    );
    expect(state.from.mock.calls).toEqual([["nexo_pessoas"]]);
  });

  it("transfers the active membership instead of changing a historical one", async () => {
    await updateNexoPessoa(
      { ...person, vinculos: [historic, active] },
      {
        ...input,
        organizacao_id: "next-organization",
      },
    );
    expect(state.rpc).toHaveBeenCalledWith(
      "nexo_gerenciar_vinculo",
      expect.objectContaining({
        p_vinculo_id: active.id,
        p_acao: "transferir",
        p_organizacao_id: "next-organization",
      }),
    );
  });

  it("does not reactivate historical memberships when saving personal details", async () => {
    await updateNexoPessoa({ ...person, vinculos: [historic] }, { ...input, organizacao_id: "" });
    expect(state.rpc).not.toHaveBeenCalled();
    expect(state.from.mock.calls).toEqual([["nexo_pessoas"]]);
  });

  it("reactivates an explicitly selected past organization without violating its unique link", async () => {
    await updateNexoPessoa(
      { ...person, vinculos: [historic] },
      {
        ...input,
        organizacao_id: historic.organizacao_id,
      },
    );
    expect(state.rpc).toHaveBeenCalledWith(
      "nexo_gerenciar_vinculo",
      expect.objectContaining({
        p_vinculo_id: historic.id,
        p_acao: "atualizar",
        p_status: "confirmado",
      }),
    );
    expect(state.from.mock.calls).toEqual([["nexo_pessoas"]]);
  });

  it("unlinks through the audited RPC with an accepted RPC status", async () => {
    await updateNexoPessoa(
      { ...person, vinculos: [historic, active] },
      {
        ...input,
        vinculo_status: "desvinculado",
      },
    );
    expect(state.rpc).toHaveBeenCalledWith(
      "nexo_gerenciar_vinculo",
      expect.objectContaining({
        p_vinculo_id: active.id,
        p_acao: "remover",
        p_status: "nao_confirmado",
      }),
    );
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
