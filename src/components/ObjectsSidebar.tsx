import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Banknote,
  ChartNoAxesCombined,
  CircleDot,
  Crosshair,
  FileText,
  Gem,
  KeyRound,
  LogOut,
  Package,
  PackageCheck,
  Pill,
  Smartphone,
  Undo2,
  Warehouse,
  Wrench,
} from "lucide-react";
import { getProfileAvatarPublicUrl, logout } from "@/lib/auth";
import type { UserProfile } from "@/lib/authz";
import { AppearanceSwitcher } from "./AppearanceSwitcher";

const sections = [
  {
    label: "CUSTÓDIA",
    items: [
      { title: "Visão Geral", url: "/objetos", icon: ChartNoAxesCombined, exact: true },
      { title: "Apreendidos", url: "/objetos/todos?situation=apreendido", icon: KeyRound },
      {
        title: "Liberados / Devolvidos",
        url: "/objetos/todos?situation=liberado",
        icon: PackageCheck,
      },
    ],
  },
  {
    label: "CATEGORIAS",
    separated: true,
    items: [
      { title: "Todos os Objetos", url: "/objetos/todos", icon: Package },
      { title: "Armas de Fogo", url: "/objetos/todos?objectType=arma_fogo", icon: Crosshair },
      { title: "Munição", url: "/objetos/todos?objectType=municao", icon: CircleDot },
      { title: "Entorpecentes", url: "/objetos/todos?objectType=entorpecente", icon: Pill },
      {
        title: "Dinheiro / Valores",
        url: "/objetos/todos?objectType=dinheiro_valores",
        icon: Banknote,
      },
      { title: "Eletrônicos", url: "/objetos/todos?objectType=eletronico", icon: Smartphone },
      { title: "Documentos", url: "/objetos/todos?objectType=documento", icon: FileText },
      {
        title: "Joias / Bens de Valor",
        url: "/objetos/todos?objectType=joia_bem_valor",
        icon: Gem,
      },
      { title: "Ferramentas", url: "/objetos/todos?objectType=ferramenta", icon: Wrench },
      { title: "Outros", url: "/objetos/todos?objectType=outro", icon: Warehouse },
    ],
  },
] as const;

export function ObjectsSidebar({ profile }: { profile: UserProfile }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  // Objeto já interpretado pelo roteador — nunca reconstruir isso a partir de
  // uma string de query própria, é a mesma armadilha que já corrigimos em
  // inqueritos/representações.
  const currentSearch = useRouterState({
    select: (state) => state.location.search as Record<string, unknown>,
  });
  const navigate = useNavigate();
  const avatarUrl = getProfileAvatarPublicUrl(profile.avatar_path);
  const initial = (profile.nome?.trim().charAt(0) || "?").toUpperCase();

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:sticky md:top-0 md:flex">
      <div className="flex items-center gap-3 border-b border-sidebar-border/90 px-5 py-5">
        <Link
          to="/modulos"
          aria-label="Voltar aos módulos"
          className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning"
        >
          <div className="sipi-brand-emblem sipi-brand-emblem-warning sipi-brand-emblem-desktop flex h-14 w-14 items-center justify-center">
            <img
              src="/sied-mark.svg?v=2"
              alt="Logo SIED"
              className="sipi-brand-emblem-image h-[92%] w-auto object-contain"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold tracking-wide text-sidebar-foreground group-hover:text-warning">
              SIED
            </div>
            <div className="-mt-0.5 truncate text-xs text-muted-foreground">
              Objetos Apreendidos
            </div>
          </div>
        </Link>
        <AppearanceSwitcher />
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2">
        {sections.map((section) => (
          <div
            key={section.label}
            className={"separated" in section && section.separated ? "mt-8" : "mt-3 first:mt-0"}
          >
            <div className="mb-1.5 px-2 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground">
              {section.label}
            </div>
            <div className="space-y-1">
              {section.items.map((item) => {
                const [itemPath, itemSearchStr] = item.url.split("?");
                const itemSearch = itemSearchStr
                  ? Object.fromEntries(new URLSearchParams(itemSearchStr))
                  : {};
                const active =
                  "exact" in item && item.exact
                    ? pathname === itemPath
                    : pathname === itemPath &&
                      Object.entries(itemSearch).every(
                        ([key, value]) => currentSearch[key] === value,
                      ) &&
                      (Object.keys(itemSearch).length > 0
                        ? true
                        : !currentSearch.situation && !currentSearch.objectType);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.url}
                    to={itemPath}
                    search={itemSearchStr ? itemSearch : undefined}
                    className={`group flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      active
                        ? "border-warning/35 bg-warning/15 text-warning"
                        : "border-transparent text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{item.title}</span>
                    {active ? <span aria-hidden="true">›</span> : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="flex shrink-0 items-center gap-2 border-t border-sidebar-border p-4">
        <Link
          to="/perfil"
          className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1.5 hover:bg-sidebar-accent"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={`Avatar de ${profile.nome}`}
              className="h-9 w-9 rounded-full border border-warning/40 object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-warning/40 bg-warning/15 text-xs font-bold text-warning">
              {initial}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold text-sidebar-foreground">
              {profile.nome}
            </div>
            <div className="truncate text-[10px] text-muted-foreground">{profile.cargo}</div>
          </div>
        </Link>
        <button
          type="button"
          onClick={async () => {
            await logout();
            navigate({ to: "/login", replace: true });
          }}
          className="text-muted-foreground transition-colors hover:text-destructive"
          aria-label="Sair"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
      <Link
        to="/modulos"
        className="mx-4 mb-4 inline-flex items-center gap-2 text-[11px] text-muted-foreground hover:text-warning"
      >
        <Undo2 className="h-3.5 w-3.5" /> Sair do módulo
      </Link>
    </aside>
  );
}
