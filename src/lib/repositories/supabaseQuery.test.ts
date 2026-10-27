import { describe, expect, it, vi } from "vitest";
import { runSupabaseMutation, runSupabaseQuery } from "./supabaseQuery";

function transientOnce<T>(data: T) {
  const state = { calls: 0 };
  const execute = async () => {
    state.calls += 1;
    if (state.calls === 1) throw { name: "TypeError", message: "Failed to fetch" };
    return { data, error: null };
  };
  return { state, execute };
}

describe("supabaseQuery", () => {
  it("repete a leitura quando a rede falha de forma transitória", async () => {
    const { state, execute } = transientOnce({ id: "1" });

    await expect(runSupabaseQuery("leitura", execute)).resolves.toEqual({ id: "1" });
    expect(state.calls).toBe(2);
  });

  it("não repete a gravação: retentativa duplicaria o registro", async () => {
    const { state, execute } = transientOnce({ id: "1" });

    await expect(runSupabaseMutation("gravação", execute)).rejects.toMatchObject({
      message: "Failed to fetch",
    });
    expect(state.calls).toBe(1);
  });

  it("renova a sessão uma vez e repete uma leitura rejeitada com 401", async () => {
    const recoverAuthentication = vi.fn().mockResolvedValue(true);
    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST301", message: "JWT expired" },
        status: 401,
      })
      .mockResolvedValueOnce({ data: { id: "1" }, error: null, status: 200 });

    await expect(
      runSupabaseQuery("leitura autenticada", execute, { recoverAuthentication }),
    ).resolves.toEqual({ id: "1" });
    expect(recoverAuthentication).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("não repete uma mutação rejeitada com 401", async () => {
    const recoverAuthentication = vi.fn().mockResolvedValue(true);
    const execute = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST301", message: "JWT expired" },
      status: 401,
    });

    await expect(
      runSupabaseMutation("gravação autenticada", execute, { recoverAuthentication }),
    ).rejects.toMatchObject({ code: "PGRST301" });
    expect(recoverAuthentication).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("preserva o erro 401 quando a sessão não pode ser renovada", async () => {
    const recoverAuthentication = vi.fn().mockResolvedValue(false);
    const error = { code: "PGRST301", message: "JWT expired" };
    const execute = vi.fn().mockResolvedValue({ data: null, error, status: 401 });

    await expect(
      runSupabaseQuery("leitura autenticada", execute, { recoverAuthentication }),
    ).rejects.toBe(error);
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
