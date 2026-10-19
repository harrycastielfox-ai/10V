import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(new URL("./nexoVisual.css", import.meta.url), "utf8");

function luminance(hex: string) {
  const channels = hex
    .replace("#", "")
    .match(/../g)!
    .map((part) => {
      const value = Number.parseInt(part, 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(foreground: string, background: string) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function token(name: string) {
  const match = stylesheet.match(new RegExp(`--nexo-${name}: (#[a-f0-9]{6})`));
  if (!match) throw new Error(`Token visual ausente: ${name}`);
  return match[1];
}

describe("fundação visual do NEXO", () => {
  it("mantém texto principal e secundário legível no canvas e nos cartões", () => {
    for (const foreground of [token("ink"), token("muted")]) {
      for (const background of [token("canvas"), "#ffffff"]) {
        expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("mantém placeholders e rótulos de seção com contraste de texto normal", () => {
    expect(contrast("#617989", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#11788c", token("canvas"))).toBeGreaterThanOrEqual(4.5);
  });

  it("mantém navegação e ações com contraste alto", () => {
    expect(contrast("#a1bdcc", "#0c2131")).toBeGreaterThanOrEqual(7);
    expect(contrast("#ffffff", "#153d55")).toBeGreaterThanOrEqual(7);
    expect(contrast("#a3e5eb", "#0c2131")).toBeGreaterThanOrEqual(7);
  });

  it("limita o tema às superfícies NEXO e respeita movimento reduzido", () => {
    expect(stylesheet).toContain(".nexo-workspace,");
    expect(stylesheet).toContain(".nexo-themed");
    expect(stylesheet).toContain("@media screen");
    expect(stylesheet).toContain("@media (prefers-reduced-motion: reduce)");
    expect(stylesheet).toContain("outline-offset: -5px");
  });
});
