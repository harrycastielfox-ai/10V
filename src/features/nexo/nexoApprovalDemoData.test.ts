import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { NEXO_APPROVAL_DEMO_DATA } from "./nexoApprovalDemoData";

describe("NEXO approval demo", () => {
  it("contains three organizations with eight fictional people and branched hierarchy each", () => {
    expect(NEXO_APPROVAL_DEMO_DATA.organizations).toHaveLength(3);
    expect(NEXO_APPROVAL_DEMO_DATA.people).toHaveLength(24);
    expect(NEXO_APPROVAL_DEMO_DATA.organizations[0].cor).toBe("#dc2626");
    expect(new Set(NEXO_APPROVAL_DEMO_DATA.organizations.map((org) => org.cor)).size).toBe(3);
    for (const organization of NEXO_APPROVAL_DEMO_DATA.organizations) {
      expect(organization.nome).toContain("DEMONSTRAÇÃO");
      const members = NEXO_APPROVAL_DEMO_DATA.people.filter((person) =>
        person.vinculos.some((link) => link.organizacao_id === organization.id),
      );
      expect(members).toHaveLength(8);
      expect(members.every((person) => person.nome.includes("fictícia"))).toBe(true);

      const links = members.flatMap((person) =>
        person.vinculos.filter((link) => link.organizacao_id === organization.id),
      );
      const linksById = new Map(links.map((link) => [link.id, link]));
      const childCountByParent = new Map<string, number>();
      for (const link of links) {
        if (!link.superior_vinculo_id) continue;
        childCountByParent.set(
          link.superior_vinculo_id,
          (childCountByParent.get(link.superior_vinculo_id) ?? 0) + 1,
        );
      }
      expect(links.filter((link) => !link.superior_vinculo_id)).toHaveLength(1);
      expect([...childCountByParent.values()].some((count) => count >= 2)).toBe(true);
      expect(
        links.some((link) => {
          const parent = link.superior_vinculo_id ? linksById.get(link.superior_vinculo_id) : null;
          return Boolean(parent?.superior_vinculo_id);
        }),
      ).toBe(true);
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
      expect(
        NEXO_APPROVAL_DEMO_DATA.observations.some((note) => note.pessoa_id === person.id),
      ).toBe(true);
    }
  });
});
