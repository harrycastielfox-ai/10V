import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserProfile } from "@/lib/authz";

const searchBos = vi.fn();
const searchInqueritosForLink = vi.fn();
const searchRepresentacoesForLink = vi.fn();
const listVehiclesPage = vi.fn();

vi.mock("@/lib/repositories/boRepository", () => ({
  searchBos: (...args: unknown[]) => searchBos(...args),
}));
vi.mock("@/lib/repositories/inqueritosRepository", () => ({
  searchInqueritosForLink: (...args: unknown[]) => searchInqueritosForLink(...args),
}));
vi.mock("@/lib/repositories/representacoesRepository", () => ({
  searchRepresentacoesForLink: (...args: unknown[]) => searchRepresentacoesForLink(...args),
}));
vi.mock("@/lib/repositories/vehiclesRepository", () => ({
  listVehiclesPage: (...args: unknown[]) => listVehiclesPage(...args),
}));

const { searchEverywhere } = await import("./globalSearch");

function perfil(cargo: UserProfile["cargo"]): UserProfile {
  return {
    id: "perfil-1",
    nome: "Servidor",
    email: "servidor@pc.ba.gov.br",
    login: "servidor",
    avatar_path: null,
    funcao_institucional: "investigador",
    cargo,
    status_autorizacao: "autorizado",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  searchInqueritosForLink.mockResolvedValue([
    {
      id: "ip-1",
      numero_ppe: "0231/2026",
      tipo: "IP",
      tipo_procedimento_normalizado: "IP",
      situacao: "Em andamento",
    },
  ]);
  searchBos.mockResolvedValue([
    {
      id: "bo-1",
      numero_bo: "00614727/2026",
      infracao_penal: "Recuperação de veículo",
      responsavel_nome: "Equipe A",
    },
  ]);
  listVehiclesPage.mockResolvedValue([
    {
      id: "v-1",
      plate: "RPI7G50",
      internal_id: "V-1",
      brand_model: "HONDA/CG 160 TITAN",
      color: "VERMELHA",
      situation: "Recuperado",
    },
  ]);
  searchRepresentacoesForLink.mockResolvedValue([
    {
      id: "r-1",
      numero_ppe: "0231/2026",
      processo_judicial: "8000123-45",
      tipo: "Prisão preventiva",
      status: "Deferida",
    },
  ]);
});

describe("searchEverywhere", () => {
  it("não consulta nada com termo curto demais", async () => {
    expect(await searchEverywhere("a", perfil("admin"))).toEqual([]);
    expect(searchInqueritosForLink).not.toHaveBeenCalled();
  });

  it("devolve os grupos na ordem definida", async () => {
    const itens = await searchEverywhere("0231", perfil("admin"));

    expect(itens.map((item) => item.group)).toEqual([
      "procedimentos",
      "boletins",
      "veiculos",
      "representacoes",
    ]);
    expect(itens[0]).toMatchObject({
      title: "0231/2026",
      to: "/inqueritos/$caseId",
      params: { caseId: "ip-1" },
    });
  });

  it("consulta apenas os módulos que o perfil pode ver", async () => {
    const itens = await searchEverywhere("0231", perfil("membro"));

    expect(searchInqueritosForLink).toHaveBeenCalledTimes(1);
    expect(searchBos).not.toHaveBeenCalled();
    expect(itens.every((item) => item.group === "procedimentos")).toBe(true);
  });

  it("mantém o resultado dos outros módulos quando um deles falha", async () => {
    searchBos.mockRejectedValue(new Error("indisponível"));

    const itens = await searchEverywhere("0231", perfil("admin"));

    expect(itens.some((item) => item.group === "boletins")).toBe(false);
    expect(itens.some((item) => item.group === "veiculos")).toBe(true);
  });

  it("monta o subtítulo do veículo com marca, cor e situação", async () => {
    const itens = await searchEverywhere("RPI7G50", perfil("admin"));
    const veiculo = itens.find((item) => item.group === "veiculos");

    expect(veiculo?.title).toBe("RPI7G50");
    expect(veiculo?.subtitle).toBe("HONDA/CG 160 TITAN · VERMELHA · Recuperado");
  });
});
