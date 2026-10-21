import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { NEXO_APPROVAL_DEMO_DATA } from "./nexoApprovalDemoData";

describe("NEXO approval demo", () => {
  it("contains exactly three organizations with three explicitly fictional people each", () => {
    expect(NEXO_APPROVAL_DEMO_DATA.organizations).toHaveLength(3);
    expect(NEXO_APPROVAL_DEMO_DATA.people).toHaveLength(9);
    expect(NEXO_APPROVAL_DEMO_DATA.organizations[0].cor).toBe("#dc2626");
    expect(new Set(NEXO_APPROVAL_DEMO_DATA.organizations.map((org) => org.cor)).size).toBe(3);
    for (const organization of NEXO_APPROVAL_DEMO_DATA.organizations) {
      expect(organization.nome).toContain("DEMONSTRAÇÃO");
      const members = NEXO_APPROVAL_DEMO_DATA.people.filter((person) =>
        person.vinculos.some((link) => link.organizacao_id === organization.id),
      );
      expect(members).toHaveLength(3);
      expect(members.every((person) => person.nome.includes("fictícia"))).toBe(true);
    }
    expect(NEXO_APPROVAL_DEMO_DATA.records).toHaveLength(0);
    expect(NEXO_APPROVAL_DEMO_DATA.territories).toHaveLength(0);
  });

  it("provides an existing portrait and filled illustrative details for every person", () => {
    for (const person of NEXO_APPROVAL_DEMO_DATA.people) {
      expect(person.foto_perfil_url).toBeTruthy();
      expect(existsSync(join(process.cwd(), "public", person.foto_perfil_url!))).toBe(true);
      expect(person.fotos.some((photo) => photo.url === person.foto_perfil_url)).toBe(true);
      expect(person.profissao).toContain("fictício");
      expect(person.escolaridade).toContain("fictício");
      expect(NEXO_APPROVAL_DEMO_DATA.observations.some((note) => note.pessoa_id === person.id)).toBe(true);
    }
  });
});
