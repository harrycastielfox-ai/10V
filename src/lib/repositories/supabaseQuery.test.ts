import { describe, expect, it } from "vitest";
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
});
