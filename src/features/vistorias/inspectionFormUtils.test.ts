import { describe, expect, it } from "vitest";
import { getLocalInspectionDate, isValidInspectionDate } from "./inspectionFormUtils";

describe("datas do formulário de vistoria", () => {
  it("usa o dia local mesmo quando a data UTC já passou para o dia seguinte", () => {
    const localDate = new Date(2026, 9, 19, 23, 45);
    expect(getLocalInspectionDate(localDate)).toBe("2026-10-19");
  });

  it.each(["", "2026-02-29", "2026-04-31", "2026-13-01", "19/10/2026"])(
    "recusa uma data vazia, inexistente ou fora do formato: %s",
    (value) => expect(isValidInspectionDate(value)).toBe(false),
  );

  it.each(["2024-02-29", "2026-10-19"])("aceita a data válida %s", (value) => {
    expect(isValidInspectionDate(value)).toBe(true);
  });
});
