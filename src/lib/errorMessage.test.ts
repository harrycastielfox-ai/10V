import { describe, expect, it } from "vitest";
import { getErrorCode, getErrorMessage } from "./errorMessage";

describe("errorMessage", () => {
  it("reads PostgREST error objects without rendering object Object", () => {
    const cause = {
      code: "42501",
      message: "new row violates row-level security policy",
      details: "boletins_ocorrencia",
    };

    expect(getErrorCode(cause)).toBe("42501");
    expect(getErrorMessage(cause, "Falha")).toBe(
      "new row violates row-level security policy (boletins_ocorrencia)",
    );
  });

  it("uses the fallback for values without a readable message", () => {
    expect(getErrorMessage({}, "Nao foi possivel concluir.")).toBe("Nao foi possivel concluir.");
  });
});
