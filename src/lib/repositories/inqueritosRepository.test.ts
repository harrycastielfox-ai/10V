import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rpcCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
}));

vi.mock("@/lib/sessionCache", () => ({
  currentSessionGeneration: () => 0,
  isSessionGenerationCurrent: () => true,
  registerSessionCache: () => undefined,
}));

vi.mock("@/lib/repositories/supabaseQuery", () => ({
  runSupabaseMutation: async (
    _label: string,
    operation: (signal: AbortSignal) => Promise<{ data: unknown; error: unknown }>,
  ) => {
    const result = await operation(new AbortController().signal);
    if (result.error) throw result.error;
    return result.data;
  },
  runSupabaseQuery: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    rpc: (name: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ name, args });
      return {
        abortSignal: async () => ({ data: null, error: null }),
      };
    },
  },
}));

const { replaceInqueritoPessoas } = await import("./inqueritosRepository");

describe("replaceInqueritoPessoas", () => {
  beforeEach(() => {
    state.rpcCalls = [];
  });

  it("envia à RPC o contrato normalizado com IDs estáveis e referências NEXO", async () => {
    await replaceInqueritoPessoas("11111111-1111-4111-8111-111111111111", [
      {
        id: "22222222-2222-4222-8222-222222222222",
        papel: "autor_investigado",
        nome: "  Pessoa Sintética  ",
        observacao: "  observação revisada  ",
        autoria_determinada: false,
        preso: true,
        nexo_pessoa_id: "33333333-3333-4333-8333-333333333333",
        nexo_organizacao_id: "44444444-4444-4444-8444-444444444444",
        nexo_vinculo_id: "55555555-5555-4555-8555-555555555555",
        faccao_nome_informada: "  Organização sintética  ",
        faccao_sigla_informada: "  OS  ",
        funcao_faccao_informada: "  função sintética  ",
        faccao_fonte_informada: "  fonte sintética  ",
        ordem: 99,
      },
      {
        id: "66666666-6666-4666-8666-666666666666",
        papel: "testemunha",
        nome: "   ",
        observacao: null,
        autoria_determinada: null,
        preso: null,
        nexo_pessoa_id: null,
        nexo_organizacao_id: null,
        nexo_vinculo_id: null,
        faccao_nome_informada: null,
        faccao_sigla_informada: null,
        funcao_faccao_informada: null,
        faccao_fonte_informada: null,
        ordem: 100,
      },
    ]);

    expect(state.rpcCalls).toEqual([
      {
        name: "replace_inquerito_pessoas",
        args: {
          p_inquerito_id: "11111111-1111-4111-8111-111111111111",
          p_pessoas: [
            {
              id: "22222222-2222-4222-8222-222222222222",
              papel: "autor_investigado",
              nome: "Pessoa Sintética",
              observacao: "observação revisada",
              autoria_determinada: false,
              preso: true,
              nexo_pessoa_id: "33333333-3333-4333-8333-333333333333",
              nexo_organizacao_id: "44444444-4444-4444-8444-444444444444",
              nexo_vinculo_id: "55555555-5555-4555-8555-555555555555",
              faccao_nome_informada: "Organização sintética",
              faccao_sigla_informada: "OS",
              funcao_faccao_informada: "função sintética",
              faccao_fonte_informada: "fonte sintética",
              ordem: 0,
            },
          ],
        },
      },
    ]);
  });

  it("envia lista vazia para remover vínculos antigos quando todas as linhas estão vazias", async () => {
    await replaceInqueritoPessoas("11111111-1111-4111-8111-111111111111", [
      {
        id: "22222222-2222-4222-8222-222222222222",
        papel: "vitima",
        nome: " ",
        observacao: null,
        autoria_determinada: null,
        preso: null,
        nexo_pessoa_id: null,
        nexo_organizacao_id: null,
        nexo_vinculo_id: null,
        faccao_nome_informada: null,
        faccao_sigla_informada: null,
        funcao_faccao_informada: null,
        faccao_fonte_informada: null,
        ordem: 0,
      },
    ]);

    expect(state.rpcCalls[0]).toEqual({
      name: "replace_inquerito_pessoas",
      args: {
        p_inquerito_id: "11111111-1111-4111-8111-111111111111",
        p_pessoas: [],
      },
    });
  });
});
