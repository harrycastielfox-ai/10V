import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Building2,
  Car,
  ClipboardList,
  CornerDownLeft,
  FileText,
  Loader2,
  Plus,
  Scale,
  Search,
  UserRound,
} from "lucide-react";
import { useAppProfile } from "@/components/AppProfileContext";
import { normalizeProceduralTagSearch } from "@/lib/proceduralTags";
import {
  canCreateCases,
  canManageAgenda,
  canManageBos,
  canCreateVehicles,
  canViewBos,
  canViewVehicles,
} from "@/lib/authz";
import {
  GLOBAL_SEARCH_GROUP_LABELS,
  GLOBAL_SEARCH_MIN_LENGTH,
  searchEverywhere,
  type GlobalSearchGroup,
  type GlobalSearchHit,
} from "@/lib/globalSearch";

type PaletteItem = {
  key: string;
  section: string;
  title: string;
  subtitle: string;
  to: string;
  params: Record<string, string>;
  icon: typeof Search;
};

const GROUP_ICONS: Record<GlobalSearchGroup, typeof Search> = {
  procedimentos: FileText,
  boletins: ClipboardList,
  veiculos: Car,
  pessoas: UserRound,
  representacoes: Scale,
};

export function CommandPalette() {
  const profile = useAppProfile();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<GlobalSearchHit[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [destaque, setDestaque] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  // Ctrl+K abre de qualquer tela; no Mac, Cmd+K.
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === "k") {
        evento.preventDefault();
        setOpen((atual) => !atual);
      }
    };

    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      return;
    }
    setQuery("");
    setTermo("");
    setResultados([]);
    setDestaque(0);
  }, [open]);

  // Espera curta enquanto se digita: só o último termo vira consulta.
  useEffect(() => {
    const timer = window.setTimeout(() => setTermo(query), 200);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open) return;

    const busca = termo.trim();
    if (busca.length < GLOBAL_SEARCH_MIN_LENGTH) {
      setResultados([]);
      setBuscando(false);
      return;
    }

    let ativo = true;
    setBuscando(true);
    void searchEverywhere(busca, profile)
      .then((itens) => {
        if (ativo) setResultados(itens);
      })
      .catch((erro) => console.warn("[busca-global]", erro))
      .finally(() => {
        if (ativo) setBuscando(false);
      });

    return () => {
      ativo = false;
    };
  }, [open, profile, termo]);

  const comandos = useMemo<PaletteItem[]>(() => {
    const lista: Array<{ title: string; to: string; permitido: boolean }> = [
      { title: "Novo procedimento", to: "/novo-caso", permitido: canCreateCases(profile) },
      { title: "Cadastrar B.O.", to: "/bo/novo", permitido: canManageBos(profile) },
      { title: "Cadastrar veículo", to: "/veiculos/novo", permitido: canCreateVehicles(profile) },
      { title: "Novo agendamento", to: "/agenda/novo", permitido: canManageAgenda(profile) },
      { title: "Abrir procedimentos", to: "/inqueritos", permitido: true },
      { title: "Abrir boletins", to: "/bo/boletins", permitido: canViewBos(profile) },
      { title: "Abrir veículos", to: "/veiculos/todos", permitido: canViewVehicles(profile) },
      { title: "Abrir alertas", to: "/alertas", permitido: true },
      { title: "Abrir estatísticas", to: "/estatisticas", permitido: true },
    ];

    return lista
      .filter((item) => item.permitido)
      .map((item) => ({
        key: `comando-${item.to}`,
        section: "Ir para",
        title: item.title,
        subtitle: item.to,
        to: item.to,
        params: {},
        icon: item.to.includes("/novo") ? Plus : Building2,
      }));
  }, [profile]);

  const itens = useMemo<PaletteItem[]>(() => {
    const busca = normalizeProceduralTagSearch(query);

    const comandosVisiveis = busca
      ? comandos.filter((item) => normalizeProceduralTagSearch(item.title).includes(busca))
      : comandos.slice(0, 4);

    const encontrados: PaletteItem[] = resultados.map((item) => ({
      key: item.key,
      section: GLOBAL_SEARCH_GROUP_LABELS[item.group],
      title: item.title,
      subtitle: item.subtitle,
      to: item.to,
      params: item.params,
      icon: GROUP_ICONS[item.group],
    }));

    return [...encontrados, ...comandosVisiveis];
  }, [comandos, query, resultados]);

  useEffect(() => {
    setDestaque(0);
  }, [itens.length]);

  const abrir = useCallback(
    (item: PaletteItem) => {
      setOpen(false);
      void navigate({ to: item.to as never, params: item.params as never });
    },
    [navigate],
  );

  const aoTeclarNaCaixa = (evento: React.KeyboardEvent<HTMLDivElement>) => {
    if (evento.key === "Escape") {
      evento.preventDefault();
      setOpen(false);
      return;
    }
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      setDestaque((atual) => (itens.length ? (atual + 1) % itens.length : 0));
      return;
    }
    if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setDestaque((atual) => (itens.length ? (atual - 1 + itens.length) % itens.length : 0));
      return;
    }
    if (evento.key === "Enter" && itens[destaque]) {
      evento.preventDefault();
      abrir(itens[destaque]);
    }
  };

  useEffect(() => {
    const elemento = listaRef.current?.querySelector<HTMLElement>('[data-destacado="true"]');
    elemento?.scrollIntoView({ block: "nearest" });
  }, [destaque, itens]);

  if (!open) return null;

  const buscaCurta = query.trim().length > 0 && query.trim().length < GLOBAL_SEARCH_MIN_LENGTH;
  const semResultado =
    !buscando && !buscaCurta && query.trim().length >= GLOBAL_SEARCH_MIN_LENGTH && !itens.length;

  let secaoAtual = "";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-background/80 px-4 pt-[12vh] backdrop-blur-sm"
      role="presentation"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) setOpen(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Busca global"
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
        onKeyDown={aoTeclarNaCaixa}
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(evento) => setQuery(evento.target.value)}
            placeholder="Placa, chassi, nº do B.O., PPE, nome..."
            aria-label="Buscar em todo o sistema"
            className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
          />
          {buscando ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" /> : null}
          <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            Esc
          </kbd>
        </div>

        <div ref={listaRef} role="listbox" className="max-h-[52vh] overflow-y-auto p-2">
          {itens.map((item, indice) => {
            const novaSecao = item.section !== secaoAtual;
            secaoAtual = item.section;
            const destacado = indice === destaque;
            const Icone = item.icon;

            return (
              <div key={item.key}>
                {novaSecao ? (
                  <p className="px-2 pb-1 pt-3 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                    {item.section}
                  </p>
                ) : null}
                <button
                  type="button"
                  role="option"
                  aria-selected={destacado}
                  data-destacado={destacado}
                  onMouseEnter={() => setDestaque(indice)}
                  onClick={() => abrir(item)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    destacado ? "bg-accent" : "hover:bg-accent/60"
                  }`}
                >
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-lg border ${
                      destacado
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    <Icone className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {item.title}
                    </span>
                    {item.subtitle ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.subtitle}
                      </span>
                    ) : null}
                  </span>
                  {destacado ? (
                    <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : null}
                </button>
              </div>
            );
          })}

          {buscaCurta ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              Digite pelo menos {GLOBAL_SEARCH_MIN_LENGTH} caracteres.
            </p>
          ) : null}

          {semResultado ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              Nada encontrado para “{query.trim()}”.
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-3">
            <span>↑↓ navegar</span>
            <span>Enter abrir</span>
          </span>
          <span>Busca respeita as permissões do seu perfil</span>
        </div>
      </div>
    </div>
  );
}
