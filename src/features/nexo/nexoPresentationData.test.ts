import { describe, expect, it } from "vitest";
import {
  NEXO_PRESENTATION_AUTHOR_ID,
  NEXO_PRESENTATION_DATA,
  nexoPresentationMapsUrl,
} from "./nexoPresentationData";

const data = NEXO_PRESENTATION_DATA;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/;

describe("synthetic NEXO presentation dataset", () => {
  it("contains exactly five distinct fictional factions and ten members per faction", () => {
    expect(data.organizations).toHaveLength(5);
    expect(data.people).toHaveLength(50);
    expect(new Set(data.organizations.map((organization) => organization.cor)).size).toBe(5);
    for (const organization of data.organizations) {
      expect(organization.nome).toContain("(Fictícia)");
      const links = data.people
        .flatMap((person) => person.vinculos)
        .filter((link) => link.organizacao_id === organization.id);
      expect(links).toHaveLength(10);
      expect(links.filter((link) => link.funcao === "Líder")).toHaveLength(1);
      expect(links.filter((link) => link.funcao === "Vice-líder")).toHaveLength(1);
      expect(links.filter((link) => link.funcao?.startsWith("Coordenador"))).toHaveLength(2);
      expect(links.filter((link) => link.funcao === "Integrante")).toHaveLength(6);
    }
  });

  it("uses stable UUIDs without duplicate identities across entities", () => {
    const ids = [
      ...data.organizations.map((item) => item.id),
      ...data.territories.map((item) => item.id),
      ...data.people.flatMap((person) => [
        person.id,
        person.endereco!.id,
        ...person.vinculos.map((link) => link.id),
        ...person.fotos.map((photo) => photo.id),
        ...person.contatos.map((contact) => contact.id),
        ...person.documentos_extras.map((document) => document.id),
      ]),
      ...data.procedures.map((item) => item.id),
      ...data.records.map((item) => item.id),
      ...data.observations.map((item) => item.id),
      ...data.hierarchyEvents.map((item) => item.id),
      NEXO_PRESENTATION_AUTHOR_ID,
    ];
    for (const id of ids) expect(id).toMatch(uuid);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every person one distinct local synthetic portrait", () => {
    const urls = data.people.map((person) => person.foto_perfil_url);
    expect(new Set(urls).size).toBe(50);
    data.people.forEach((person, index) => {
      const number = String(index + 1).padStart(2, "0");
      expect(person.foto_perfil_url).toBe(`/nexo-demo/portraits/person-${number}.webp`);
      expect(person.foto_perfil_path).toBe(`demo-public/person-${number}.webp`);
      expect(person.foto_relatorio_url).toBe(person.foto_perfil_url);
      expect(person.fotos[0].url).toBe(person.foto_perfil_url);
      expect(person.fotos[0].legenda).toMatch(/sintético/);
    });
  });

  it("cannot be mistaken for operational personal identifiers or live contact details", () => {
    expect(data.isFictional).toBe(true);
    expect(data.disclaimer).toMatch(/inteiramente fictícios/);
    for (const person of data.people) {
      expect(person.nome).toMatch(/· DEMO$/);
      expect(person.cpf).toBeNull();
      expect(person.rg).toMatch(/^DEMO-\d{3}$/);
      expect(person.telefone).toBeNull();
      expect(person.observacoes).toBe(data.disclaimer);
      for (const contact of person.contatos) expect(contact.valor).toMatch(/@example\.invalid$/);
    }
  });

  it("maintains a same-faction acyclic superior chain and the three leadership tiers", () => {
    const links = new Map(
      data.people.flatMap((person) => person.vinculos.map((link) => [link.id, link] as const)),
    );
    for (const link of links.values()) {
      const visited = new Set<string>();
      let current: typeof link | undefined = link;
      while (current) {
        expect(visited.has(current.id)).toBe(false);
        visited.add(current.id);
        expect(current.organizacao_id).toBe(link.organizacao_id);
        if (!current.superior_vinculo_id) break;
        expect(links.has(current.superior_vinculo_id)).toBe(true);
        current = links.get(current.superior_vinculo_id);
      }
    }
    const member = data.people[4].vinculos[0];
    const coordinator = links.get(member.superior_vinculo_id!)!;
    const vice = links.get(coordinator.superior_vinculo_id!)!;
    const leader = links.get(vice.superior_vinculo_id!)!;
    expect(coordinator.funcao).toBe("Coordenador de núcleo");
    expect(vice.funcao).toBe("Vice-líder");
    expect(leader.funcao).toBe("Líder");
    expect(leader.superior_vinculo_id).toBeNull();
  });

  it("keeps map references inside Itabela's presentation extent and explicitly hypothetical", () => {
    expect(data.geography.ibgeCode).toBe("2914653");
    expect(data.geography.municipalSource).toBe("https://www.itabela.ba.gov.br/localizacao");
    const references = [...data.people.map((person) => person.endereco!), ...data.territories];
    for (const reference of references) {
      expect(reference.municipio).toBe("Itabela");
      expect(reference.uf).toBe("BA");
      expect(reference.numero).toBeNull();
      expect(reference.bairro).toMatch(/\(SIMULADO\)/);
      const url = new URL(reference.link_navegacao!);
      expect(url.origin).toBe("https://www.google.com");
      expect(url.pathname).toBe("/maps/search/");
      expect(url.searchParams.get("api")).toBe("1");
      const [latitude, longitude] = url.searchParams.get("query")!.split(",").map(Number);
      expect(latitude).toBeGreaterThan(-16.59);
      expect(latitude).toBeLessThan(-16.55);
      expect(longitude).toBeGreaterThan(-39.59);
      expect(longitude).toBeLessThan(-39.54);
    }
    for (const territory of data.territories) {
      expect(territory.categoria).toBe("outro");
      expect(territory.observacoes).toBe(data.disclaimer);
      expect(territory.pontos).toHaveLength(5);
      for (const point of territory.pontos) {
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(100);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeLessThanOrEqual(100);
      }
    }
    expect(nexoPresentationMapsUrl(-16.575, -39.552778)).toContain("query=-16.575%2C-39.552778");
  });

  it("provides ten fake incidents and five matching inquiries instead of inventing extra facts", () => {
    expect(data.procedures.filter((procedure) => procedure.type === "bo")).toHaveLength(10);
    const inquiries = data.procedures.filter((procedure) => procedure.type === "inquerito");
    expect(inquiries).toHaveLength(5);
    expect(new Set(data.procedures.map((procedure) => procedure.incidentKey)).size).toBe(10);
    for (const inquiry of inquiries) {
      const bo = data.procedures.find((procedure) => procedure.id === inquiry.relatedBoId)!;
      expect(bo.type).toBe("bo");
      expect(inquiry.relatedBoNumber).toBe(bo.number);
      expect(inquiry.incidentKey).toBe(bo.incidentKey);
      expect(inquiry.date).toBe(bo.date);
      expect(inquiry.time).toBe(bo.time);
      expect(inquiry.neighborhood).toBe(bo.neighborhood);
      expect(inquiry.cvli).toBe(bo.cvli);
    }
    for (const procedure of data.procedures) {
      expect(procedure.number).toMatch(/^DEMO-(BO|IP)-\d{4}\/2026$/);
      expect(procedure.nature).toContain("SIMULAÇÃO");
      expect(procedure.narrative).toContain(data.disclaimer);
      expect(procedure.isFictional).toBe(true);
      expect(procedure.date >= "2026-09-01" && procedure.date <= "2026-10-18").toBe(true);
      expect(procedure.time).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
    }
    const incidents = data.procedures.filter((procedure) => procedure.type === "bo");
    expect(incidents.filter((procedure) => procedure.cvli)).toHaveLength(6);
    expect(incidents.filter((procedure) => !procedure.cvli)).toHaveLength(4);
  });

  it("keeps all records, observations and history attached to valid owners", () => {
    const people = new Set(data.people.map((person) => person.id));
    const organizations = new Set(data.organizations.map((organization) => organization.id));
    const procedures = new Set(data.procedures.map((procedure) => procedure.id));
    expect(data.records).toHaveLength(30);
    for (const record of data.records) {
      expect(Number(Boolean(record.bo_id)) + Number(Boolean(record.inquerito_id))).toBe(1);
      expect(Number(Boolean(record.pessoa_id)) + Number(Boolean(record.organizacao_id))).toBe(1);
      expect(procedures.has((record.bo_id || record.inquerito_id)!)).toBe(true);
      if (record.pessoa_id) expect(people.has(record.pessoa_id)).toBe(true);
      if (record.organizacao_id) expect(organizations.has(record.organizacao_id)).toBe(true);
    }
    expect(data.observations).toHaveLength(55);
    for (const observation of data.observations) {
      expect(
        Number(Boolean(observation.pessoa_id)) + Number(Boolean(observation.organizacao_id)),
      ).toBe(1);
      if (observation.pessoa_id) expect(people.has(observation.pessoa_id)).toBe(true);
      if (observation.organizacao_id)
        expect(organizations.has(observation.organizacao_id)).toBe(true);
      expect(observation.created_by).toBe(NEXO_PRESENTATION_AUTHOR_ID);
      expect(observation.conteudo).toContain(data.disclaimer);
    }
    expect(data.hierarchyEvents).toHaveLength(50);
    for (const event of data.hierarchyEvents) {
      expect(people.has(event.pessoa_id)).toBe(true);
      expect(organizations.has(event.organizacao_id)).toBe(true);
      const person = data.people.find((person) => person.id === event.pessoa_id)!;
      expect(person.vinculos[0].id).toBe(event.vinculo_id);
      expect(person.nome).toBe(event.pessoa_nome);
    }
  });
});
