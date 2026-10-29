import type { NexoPessoa, NexoVinculo } from "./nexoTypes";

export interface NexoOrganogramPosition {
  x: number;
  y: number;
}

export interface NexoOrganogramMember {
  id: string;
  person: NexoPessoa;
  link: NexoVinculo;
  parentId: string | null;
  childIds: string[];
  depth: number;
  position: NexoOrganogramPosition;
  positionKind: "hierarchical" | "undetermined";
  /** Explicitly false: the projection never derives leadership from a role or a missing superior. */
  isLeadership: false;
}

export interface NexoOrganogramModel {
  organizationId: string;
  members: NexoOrganogramMember[];
  membersById: Map<string, NexoOrganogramMember>;
  rootIds: string[];
}

interface CandidateMember {
  id: string;
  person: NexoPessoa;
  link: NexoVinculo;
}

const HORIZONTAL_GAP = 360;
const VERTICAL_GAP = 180;

function normalizedSearchValue(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function createsCycle(id: string, parentId: string, parents: Map<string, string | null>) {
  const visited = new Set<string>();
  let cursor: string | null = parentId;

  while (cursor) {
    if (cursor === id) return true;
    if (visited.has(cursor)) return true;
    visited.add(cursor);
    cursor = parents.get(cursor) ?? null;
  }

  return false;
}

export function buildNexoOrganogram(
  organizationId: string,
  people: NexoPessoa[],
): NexoOrganogramModel {
  const candidates: CandidateMember[] = people
    .flatMap((person) =>
      person.vinculos
        .filter((link) => link.organizacao_id === organizationId && link.status !== "desvinculado")
        .map((link) => ({ id: link.id, person, link })),
    )
    .sort((first, second) => first.id.localeCompare(second.id, "pt-BR"));

  const candidateIds = new Set(candidates.map((candidate) => candidate.id));
  const rawParents = new Map(
    candidates.map((candidate) => [
      candidate.id,
      candidate.link.superior_vinculo_id && candidateIds.has(candidate.link.superior_vinculo_id)
        ? candidate.link.superior_vinculo_id
        : null,
    ]),
  );
  const parents = new Map<string, string | null>();

  for (const candidate of candidates) {
    const parentId = rawParents.get(candidate.id) ?? null;
    parents.set(
      candidate.id,
      parentId && !createsCycle(candidate.id, parentId, rawParents) ? parentId : null,
    );
  }

  const children = new Map<string, string[]>();
  for (const candidate of candidates) children.set(candidate.id, []);
  for (const [id, parentId] of parents) {
    if (parentId) children.get(parentId)?.push(id);
  }
  for (const childIds of children.values()) childIds.sort((a, b) => a.localeCompare(b, "pt-BR"));

  const rootIds = candidates
    .filter((candidate) => !parents.get(candidate.id))
    .map((candidate) => candidate.id);
  const depthById = new Map<string, number>();
  const xById = new Map<string, number>();
  let nextLeaf = 0;

  const place = (id: string, depth: number): number => {
    depthById.set(id, depth);
    const childIds = children.get(id) ?? [];
    if (!childIds.length) {
      const x = nextLeaf * HORIZONTAL_GAP;
      nextLeaf += 1;
      xById.set(id, x);
      return x;
    }

    const firstLeaf = nextLeaf;
    childIds.forEach((childId) => place(childId, depth + 1));
    // Center each branch over its full span, including uneven descendant counts.
    const x = ((firstLeaf + nextLeaf - 1) * HORIZONTAL_GAP) / 2;
    xById.set(id, x);
    return x;
  };

  for (const rootId of rootIds) place(rootId, 1);

  const members: NexoOrganogramMember[] = candidates.map((candidate) => ({
    ...candidate,
    parentId: parents.get(candidate.id) ?? null,
    childIds: children.get(candidate.id) ?? [],
    depth: depthById.get(candidate.id) ?? 1,
    position: {
      x: xById.get(candidate.id) ?? 0,
      y: ((depthById.get(candidate.id) ?? 1) - 1) * VERTICAL_GAP,
    },
    positionKind: parents.get(candidate.id) ? "hierarchical" : "undetermined",
    isLeadership: false,
  }));
  const membersById = new Map(members.map((member) => [member.id, member]));

  return { organizationId, members, membersById, rootIds };
}

export function searchNexoOrganogram(model: NexoOrganogramModel, query: string) {
  const normalizedQuery = normalizedSearchValue(query);
  if (!normalizedQuery) return [];

  return model.members
    .filter((member) =>
      [member.person.nome, member.person.apelido].some((value) =>
        normalizedSearchValue(value).includes(normalizedQuery),
      ),
    )
    .map((member) => member.id);
}

export function getNexoOrganogramAncestors(model: NexoOrganogramModel, memberId: string) {
  const ancestors: string[] = [];
  const visited = new Set<string>();
  let cursor = model.membersById.get(memberId)?.parentId ?? null;

  while (cursor && !visited.has(cursor)) {
    visited.add(cursor);
    ancestors.unshift(cursor);
    cursor = model.membersById.get(cursor)?.parentId ?? null;
  }

  return ancestors;
}

export function getVisibleNexoOrganogram(
  model: NexoOrganogramModel,
  collapsedIds: ReadonlySet<string>,
) {
  const visibleIds: string[] = [];
  const visit = (id: string) => {
    const member = model.membersById.get(id);
    if (!member) return;
    visibleIds.push(id);
    if (collapsedIds.has(id)) return;
    member.childIds.forEach(visit);
  };

  model.rootIds.forEach(visit);
  return visibleIds;
}
