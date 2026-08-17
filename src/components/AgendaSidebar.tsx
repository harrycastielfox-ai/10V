import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { CalendarDays, CalendarPlus, History, ListOrdered, LogOut, Undo2 } from "lucide-react";
import { getProfileAvatarPublicUrl, logout } from "@/lib/auth";
import { canManageAgenda, type UserProfile } from "@/lib/authz";
import { AppearanceSwitcher } from "./AppearanceSwitcher";

const sections = [
  {
    label: "ATENDIMENTOS",
    items: [
      { title: "Agenda do dia", url: "/agenda", icon: CalendarDays, exact: true },
      { title: "Cronograma", url: "/agenda/cronograma", icon: ListOrdered },
      { title: "Histórico", url: "/agenda/historico", icon: History },
    ],
  },
] as const;

export function AgendaSidebar({ profile }: { profile: UserProfile }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const avatarUrl = getProfileAvatarPublicUrl(profile.avatar_path);
  const initial = (profile.nome?.trim().charAt(0) || "?").toUpperCase();

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:sticky md:top-0 md:flex">
      <div className="flex items-center gap-3 border-b border-sidebar-border/90 px-5 py-5">
        <Link
          to="/modulos"
          aria-label="Voltar aos módulos"
          className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
        >
          <div className="sipi-brand-emblem sipi-brand-emblem-info flex h-14 w-14 items-center justify-center">
            <img
              src="/sipi-logo.png"
              alt="Logo SIPI"
              className="sipi-brand-emblem-image h-[92%] w-auto object-contain"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold tracking-wide text-sidebar-foreground group-hover:text-info">
              SIPI
            </div>
            <div className="-mt-0.5 truncate text-xs text-muted-foreground">Agendamento</div>
          </div>
        </Link>
        <AppearanceSwitcher />
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2">
        {sections.map((section) => (
          <div key={section.label} className="mt-3 first:mt-0">
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
                    className={`group flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      active
                        ? "border-info/35 bg-info/15 text-info"
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

        {canManageAgenda(profile) ? (
          <Link
            to="/agenda/novo"
            className="mt-6 flex min-h-11 items-center justify-center gap-2 rounded-lg border border-info/60 bg-info/10 px-3 text-xs font-black uppercase tracking-wider text-info transition hover:bg-info/20"
          >
            <CalendarPlus className="h-4 w-4" /> Marcar atendimento
          </Link>
        ) : null}
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
              className="h-9 w-9 rounded-full border border-info/40 object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-info/40 bg-info/15 text-xs font-bold text-info">
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
        className="mx-4 mb-4 inline-flex items-center gap-2 text-[11px] text-muted-foreground hover:text-info"
      >
        <Undo2 className="h-3.5 w-3.5" /> Sair do módulo
      </Link>
    </aside>
  );
}
