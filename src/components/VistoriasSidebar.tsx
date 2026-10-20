import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { CarFront, ClipboardCheck, FileChartColumn, KeyRound, LogOut, Undo2 } from "lucide-react";
import { getProfileAvatarPublicUrl, logout } from "@/lib/auth";
import type { UserProfile } from "@/lib/authz";
import { AppearanceSwitcher } from "./AppearanceSwitcher";

const sections = [
  {
    label: "VISTORIAS",
    items: [{ title: "Visão geral", url: "/vistorias", icon: ClipboardCheck, exact: true }],
  },
  {
    label: "VEÍCULOS",
    separated: true,
    items: [
      { title: "Cadastro de veículos", url: "/veiculos/todos", icon: CarFront },
      { title: "Custódia e pátio", url: "/veiculos", icon: KeyRound },
      { title: "Relatórios de veículos", url: "/veiculos/relatorios", icon: FileChartColumn },
    ],
  },
] as const;

export function VistoriasSidebar({ profile }: { profile: UserProfile }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const avatarUrl = getProfileAvatarPublicUrl(profile.avatar_path);
  const initial = (profile.nome?.trim().charAt(0) || "?").toUpperCase();

  async function handleLogout() {
    await logout();
    navigate({ to: "/login" });
  }

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:sticky md:top-0 md:flex">
      <div className="flex items-center gap-3 border-b border-sidebar-border/90 px-5 py-5">
        <Link
          to="/modulos"
          aria-label="Voltar aos módulos"
          className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="sipi-brand-emblem sipi-brand-emblem-primary sipi-brand-emblem-desktop flex h-14 w-14 shrink-0 items-center justify-center">
            <img
              src="/sied-mark.svg?v=3"
              alt="Logo SIED"
              className="sipi-brand-emblem-image h-[92%] w-auto object-contain"
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold tracking-wide text-sidebar-foreground transition-colors group-hover:text-primary">
              SIED
            </span>
            <span className="-mt-0.5 block truncate text-xs text-muted-foreground">
              System Protect
            </span>
          </span>
        </Link>
        <AppearanceSwitcher />
      </div>

      <nav
        className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2"
        aria-label="Navegação de vistorias"
      >
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
                const active =
                  "exact" in item && item.exact
                    ? pathname === item.url
                    : pathname === item.url || pathname.startsWith(`${item.url}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.url}
                    to={item.url}
                    className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                      active
                        ? "border-primary/35 bg-primary/15 text-primary"
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
          className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-sidebar-accent"
          title="Acessar meu perfil"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={`Avatar de ${profile.nome}`}
              className="h-9 w-9 rounded-full border border-primary/40 object-cover"
            />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/40 bg-primary/20 text-xs font-bold text-primary">
              {initial}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-sidebar-foreground">
              {profile.nome}
            </span>
            <span className="block truncate text-[10px] text-muted-foreground">
              {profile.cargo}
            </span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="text-muted-foreground transition-colors hover:text-destructive"
          aria-label="Sair"
          title="Sair"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
      <Link
        to="/modulos"
        className="mx-4 mb-4 inline-flex items-center gap-2 text-[11px] text-muted-foreground transition-colors hover:text-primary"
      >
        <Undo2 className="h-3.5 w-3.5" /> Voltar aos módulos
      </Link>
    </aside>
  );
}
