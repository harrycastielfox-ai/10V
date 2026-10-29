import {
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Network,
  Search,
  UserCog,
  UserRound,
  X,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  buildNexoOrganogram,
  getNexoOrganogramAncestors,
  getVisibleNexoOrganogram,
  searchNexoOrganogram,
  type NexoOrganogramMember,
} from "../nexoOrganogram";
import { getNexoPersonPhotoUrl } from "../nexoSelectors";
import type { NexoOrganizacao, NexoPessoa, NexoVinculo } from "../nexoTypes";

const LINK_LABELS: Record<NexoVinculo["status"], string> = {
  confirmado: "Confirmado",
  provavel: "Provável",
  suspeito: "Suspeito",
  nao_confirmado: "Não confirmado",
  desvinculado: "Desvinculado",
};

const ORGANOGRAM_NODE_WIDTH = 320;
const ORGANOGRAM_NODE_HEIGHT = 132;

interface MemberNodeData extends Record<string, unknown> {
  member: NexoOrganogramMember;
  superiorName: string | null;
  selected: boolean;
  matched: boolean;
  collapsed: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onOpen: (person: NexoPessoa) => void;
  onManage?: (person: NexoPessoa, link: NexoVinculo) => void;
}

type MemberFlowNode = Node<MemberNodeData, "member">;
type OrganogramFlowNode = MemberFlowNode;

export interface NexoOrganogramProps {
  organization: NexoOrganizacao;
  members: { person: NexoPessoa; link: NexoVinculo }[];
  onOpen: (person: NexoPessoa) => void;
  onManage?: (person: NexoPessoa, link: NexoVinculo) => void;
  loading?: boolean;
  error?: string | null;
}

function confidenceTone(confidence: number) {
  if (confidence >= 75) return "bg-emerald-500";
  if (confidence >= 45) return "bg-amber-500";
  return "bg-slate-400";
}

const OrganogramMemberNode = memo(function OrganogramMemberNode({
  data,
}: NodeProps<MemberFlowNode>) {
  const { member } = data;
  const photoUrl = getNexoPersonPhotoUrl(member.person);
  return (
    <article
      className={`nexo-organogram-card ${data.selected ? "is-selected" : ""} ${data.matched ? "is-matched" : ""}`}
      aria-label={`${member.person.nome}, ${member.link.funcao || "função não informada"}`}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <button
        type="button"
        className="nexo-organogram-card-main"
        onClick={() => data.onSelect(member.id)}
        aria-pressed={data.selected}
      >
        {photoUrl ? (
          <img src={photoUrl} alt="" className="nexo-organogram-avatar" />
        ) : (
          <span className="nexo-organogram-avatar is-fallback" aria-hidden>
            <UserRound className="h-5 w-5" />
          </span>
        )}
        <span className="min-w-0 flex-1 text-left">
          <strong
            className="block truncate text-[13px] font-black text-[#173a54]"
            title={member.person.nome}
          >
            {member.person.nome}
          </strong>
          <span className="nexo-organogram-alias" title={member.person.apelido || undefined}>
            {member.person.apelido ? `“${member.person.apelido}”` : "Sem alcunha registrada"}
          </span>
          <span className="nexo-organogram-role" title={member.link.funcao || undefined}>
            {member.link.funcao || "Função não informada"}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-[#60798b]">
            <span
              className={`h-2 w-2 rounded-full ${confidenceTone(member.link.confianca)}`}
              aria-hidden
            />
            {LINK_LABELS[member.link.status]}
            <span aria-hidden>·</span>
            {member.link.confianca}%
          </span>
        </span>
      </button>
      <div className="nexo-organogram-card-footer">
        <span className="min-w-0 flex-1 truncate">
          {data.superiorName ? `Responde a ${data.superiorName}` : "Sem superior cadastrado"}
        </span>
        {member.childIds.length ? (
          <button
            type="button"
            onClick={() => data.onToggle(member.id)}
            aria-expanded={!data.collapsed}
            aria-label={`${data.collapsed ? "Expandir" : "Recolher"} ramificação de ${member.person.nome}`}
            title={`${data.collapsed ? "Expandir" : "Recolher"} ramificação`}
          >
            {data.collapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            {member.childIds.length}
          </button>
        ) : null}
        {data.onManage ? (
          <button
            type="button"
            onClick={() => data.onManage?.(member.person, member.link)}
            aria-label={`Gerenciar posição de ${member.person.nome}`}
            title="Gerenciar posição"
          >
            <UserCog className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => data.onOpen(member.person)}
          aria-label={`Abrir dossiê de ${member.person.nome}`}
          title="Abrir dossiê"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </article>
  );
});

const NODE_TYPES = {
  member: OrganogramMemberNode,
};

function OrganogramCanvas({
  organization,
  members,
  onOpen,
  onManage,
}: Omit<NexoOrganogramProps, "loading" | "error">) {
  const people = useMemo(
    () => Array.from(new Map(members.map(({ person }) => [person.id, person])).values()),
    [members],
  );
  const model = useMemo(
    () => buildNexoOrganogram(organization.id, people),
    [organization.id, people],
  );
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageWidth, setStageWidth] = useState(0);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => setStageWidth(entry.contentRect.width));
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);
  const bounds = useMemo(() => {
    const xs = model.members.map((member) => member.position.x);
    const ys = model.members.map((member) => member.position.y);
    return {
      left: Math.min(0, ...xs),
      right: Math.max(0, ...xs) + ORGANOGRAM_NODE_WIDTH,
      bottom: Math.max(0, ...ys) + ORGANOGRAM_NODE_HEIGHT,
    };
  }, [model]);
  const treeZoom = Math.min(1, Math.max(0.1, (stageWidth - 48) / (bounds.right - bounds.left)));
  const treeViewport = {
    x: (stageWidth - (bounds.right - bounds.left) * treeZoom) / 2 - bounds.left * treeZoom,
    y: 16,
    zoom: treeZoom,
  };
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const searchResults = useMemo(() => searchNexoOrganogram(model, query), [model, query]);
  const visibleIds = useMemo(
    () => getVisibleNexoOrganogram(model, collapsedIds),
    [collapsedIds, model],
  );
  const searchResultSet = useMemo(() => new Set(searchResults), [searchResults]);

  const focusMember = useCallback(
    (id: string) => {
      const ancestors = getNexoOrganogramAncestors(model, id);
      setCollapsedIds((current) => {
        const next = new Set(current);
        ancestors.forEach((ancestorId) => next.delete(ancestorId));
        return next;
      });
      setSelectedId(id);
    },
    [model],
  );

  const nodes = useMemo<OrganogramFlowNode[]>(() => {
    const memberNodes: MemberFlowNode[] = visibleIds.flatMap((id) => {
      const member = model.membersById.get(id);
      if (!member) return [];
      return [
        {
          id,
          type: "member",
          position: member.position,
          initialWidth: ORGANOGRAM_NODE_WIDTH,
          initialHeight: ORGANOGRAM_NODE_HEIGHT,
          draggable: false,
          selectable: false,
          data: {
            member,
            superiorName: member.parentId
              ? model.membersById.get(member.parentId)?.person.nome || null
              : null,
            selected: selectedId === id,
            matched: searchResultSet.has(id),
            collapsed: collapsedIds.has(id),
            onSelect: focusMember,
            onToggle: (memberId: string) =>
              setCollapsedIds((current) => {
                const next = new Set(current);
                if (next.has(memberId)) next.delete(memberId);
                else next.add(memberId);
                return next;
              }),
            onOpen,
            onManage,
          },
        },
      ];
    });
    return memberNodes;
  }, [collapsedIds, focusMember, model, onManage, onOpen, searchResultSet, selectedId, visibleIds]);

  const edges = useMemo<Edge[]>(() => {
    const visible = new Set(visibleIds);
    return visibleIds.flatMap((id) => {
      const member = model.membersById.get(id);
      if (!member?.parentId || !visible.has(member.parentId)) return [];
      return [
        {
          id: `${member.parentId}:${id}`,
          source: member.parentId,
          target: id,
          type: "smoothstep",
          pathOptions: { offset: 8, borderRadius: 3 },
          style: {
            stroke: "#72aebd",
            strokeWidth: 2,
          },
        },
      ];
    });
  }, [model, visibleIds]);

  const selected = selectedId ? model.membersById.get(selectedId) || null : null;
  const selectedSuperior = selected?.parentId
    ? model.membersById.get(selected.parentId)?.person.nome || null
    : null;
  const selectedChildren = selected?.childIds
    .map((id) => model.membersById.get(id)?.person.nome)
    .filter((name): name is string => Boolean(name));

  return (
    <section
      className="nexo-organogram-shell"
      style={{ "--nexo-org-accent": organization.cor } as CSSProperties}
      aria-label={`Organograma de ${organization.nome}`}
    >
      <div className="nexo-organogram-toolbar">
        <div className="nexo-organogram-search">
          <Search className="h-4 w-4" aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && searchResults[0]) focusMember(searchResults[0]);
            }}
            placeholder="Buscar por nome ou alcunha"
            aria-label="Buscar integrante no organograma"
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")} aria-label="Limpar busca">
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <span className="nexo-organogram-count">
          {model.members.length} integrante{model.members.length === 1 ? "" : "s"}
        </span>
        <span className="nexo-organogram-context" role="note">
          Sem superior cadastrado não significa liderança.
        </span>
      </div>

      {query ? (
        <div
          className="nexo-organogram-search-results"
          role="listbox"
          aria-label="Resultados da busca"
        >
          {searchResults.length ? (
            searchResults.slice(0, 8).map((id) => {
              const member = model.membersById.get(id);
              if (!member) return null;
              return (
                <button key={id} type="button" role="option" onClick={() => focusMember(id)}>
                  <strong>{member.person.nome}</strong>
                  <span>{member.person.apelido || member.link.funcao || "Sem alcunha"}</span>
                </button>
              );
            })
          ) : (
            <p>Nenhum integrante encontrado.</p>
          )}
        </div>
      ) : null}

      <div
        ref={stageRef}
        className="nexo-organogram-stage"
        style={{ height: Math.max(420, bounds.bottom * treeZoom + 80) }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          viewport={treeViewport}
          minZoom={0.1}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={false}
          panOnScroll={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          preventScrolling={false}
          selectionOnDrag={false}
          onlyRenderVisibleElements
          proOptions={{ hideAttribution: true }}
          aria-label={`Árvore do organograma de ${organization.nome}`}
        />

        {selected ? (
          <aside
            className="nexo-organogram-detail"
            aria-label={`Detalhes de ${selected.person.nome}`}
          >
            <button
              type="button"
              className="nexo-organogram-detail-close"
              onClick={() => setSelectedId(null)}
              aria-label="Fechar detalhes do integrante"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-3 pr-7">
              {getNexoPersonPhotoUrl(selected.person) ? (
                <img
                  src={getNexoPersonPhotoUrl(selected.person) || ""}
                  alt=""
                  className="h-14 w-14 rounded-2xl object-cover"
                />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e2f0f3] text-[#247e93]">
                  <UserRound className="h-6 w-6" />
                </span>
              )}
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase tracking-[.16em] text-[#28879a]">
                  Integrante selecionado
                </span>
                <h3 className="truncate text-base font-black text-[#173a54]">
                  {selected.person.nome}
                </h3>
                <p className="truncate text-xs text-[#60798b]">
                  {selected.person.apelido || "Sem alcunha registrada"}
                </p>
              </div>
            </div>
            <dl className="nexo-organogram-detail-list">
              <div>
                <dt>Organização</dt>
                <dd>{organization.nome}</dd>
              </div>
              <div>
                <dt>Função registrada</dt>
                <dd>{selected.link.funcao || "Não informada"}</dd>
              </div>
              <div>
                <dt>Superior registrado</dt>
                <dd>{selectedSuperior || "Posição não determinada"}</dd>
              </div>
              <div>
                <dt>Subordinados registrados</dt>
                <dd>{selectedChildren?.length ? selectedChildren.join(", ") : "Nenhum"}</dd>
              </div>
              <div>
                <dt>Situação e confiança</dt>
                <dd>
                  {LINK_LABELS[selected.link.status]} · {selected.link.confianca}%
                </dd>
              </div>
              <div>
                <dt>Fonte da relação</dt>
                <dd>{selected.link.fonte_resumo || "Não informada"}</dd>
              </div>
            </dl>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className="nexo-action-secondary"
                onClick={() => onOpen(selected.person)}
              >
                <ExternalLink className="h-4 w-4" /> Abrir dossiê
              </button>
              {onManage ? (
                <button
                  type="button"
                  className="nexo-action-primary"
                  onClick={() => onManage(selected.person, selected.link)}
                >
                  <UserCog className="h-4 w-4" /> Gerenciar
                </button>
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}

export function NexoOrganogram({
  organization,
  members,
  onOpen,
  onManage,
  loading = false,
  error = null,
}: NexoOrganogramProps) {
  if (loading) {
    return (
      <div className="nexo-organogram-state" role="status" aria-live="polite">
        <span className="nexo-organogram-spinner" aria-hidden />
        <strong>Carregando estrutura organizacional…</strong>
        <p>Organizando integrantes e vínculos documentados.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="nexo-organogram-state is-error" role="alert">
        <strong>Não foi possível carregar o organograma</strong>
        <p>{error}</p>
      </div>
    );
  }

  if (!members.length) {
    return (
      <div className="nexo-organogram-state">
        <Network className="h-8 w-8 text-[#3a8fa1]" aria-hidden />
        <strong>Nenhum integrante elegível para o organograma</strong>
        <p>Cadastre ou reative um vínculo para exibir a estrutura.</p>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <OrganogramCanvas
        organization={organization}
        members={members}
        onOpen={onOpen}
        onManage={onManage}
      />
    </ReactFlowProvider>
  );
}
