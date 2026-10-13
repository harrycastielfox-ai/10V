import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { House, LogOut, Radar, Route as RouteIcon, Undo2, UserRoundSearch } from "lucide-react";
import { AppearanceSwitcher } from "@/components/AppearanceSwitcher";
import { getProfileAvatarPublicUrl, logout } from "@/lib/auth";
import type { UserProfile } from "@/lib/authz";

const sections = [
  {
    label: "MAPA",
    items: [{ title: "Mapa de Contatos", url: "/localizacao", icon: Radar, exact: true }],
  },
  {
    label: "CADASTROS",
    items: [
      { title: "Pessoas / Contatos", url: "/localizacao/pessoas", icon: UserRoundSearch },
      { title: "Endereços", url: "/localizacao/enderecos", icon: House },
      { title: "Rotas salvas", url: "/localizacao/rotas", icon: RouteIcon },
    ],
  },
] as const;

export function LocalizacaoSidebar({ profile }: { profile: UserProfile }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const avatarUrl = getProfileAvatarPublicUrl(profile.avatar_path);
  const initial = (profile.nome?.trim().charAt(0) || "?").toUpperCase();

  return (
    <aside className="localizacao-sidebar hidden h-screen w-[232px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 md:sticky md:top-0 md:flex">
      <div className="localizacao-sidebar-header flex items-center gap-2 border-b border-sidebar-border px-4 py-4">
        <Link
          to="/modulos"
          aria-label="Voltar aos módulos"
          title="Voltar aos módulos"
          className="localizacao-sidebar-brand group flex min-w-0 flex-1 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-operational"
        >
          <span className="localizacao-sidebar-brand-icon sipi-brand-emblem sipi-brand-emblem-operational sipi-brand-emblem-desktop flex h-12 w-12 shrink-0 items-center justify-center">
            <img
              src="/sied-mark.svg"
              alt="Logo SIED"
              className="sipi-brand-emblem-image h-[92%] w-auto object-contain"
            />
          </span>
          <span className="localizacao-sidebar-brand-copy min-w-0">
            <strong className="block font-bold tracking-[0.12em] text-sidebar-foreground group-hover:text-operational">
              SIED
            </strong>
            <span className="block truncate text-[11px] text-muted-foreground">
              Contato Operacional
            </span>
          </span>
        </Link>
        <AppearanceSwitcher />
      </div>

      <nav className="localizacao-sidebar-nav min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-3">
        {sections.map((section, sectionIndex) => (
          <section
            key={section.label}
            className={`localizacao-sidebar-section ${sectionIndex ? "mt-7" : ""}`}
          >
            <h2 className="localizacao-sidebar-section-label mb-1.5 px-2 text-[10px] font-bold tracking-[0.2em] text-operational">
              {section.label}
            </h2>
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
                    title={item.title}
                    aria-label={item.title}
                    aria-current={active ? "page" : undefined}
                    className={`localizacao-sidebar-link group flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                      active
                        ? "border-operational/40 bg-operational/10 text-operational shadow-[inset_3px_0_0_var(--operational)]"
                        : "border-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${active ? "text-operational" : "text-muted-foreground"}`}
                    />
                    <span className="localizacao-sidebar-link-label min-w-0 flex-1 truncate">
                      {item.title}
                    </span>
                    {active ? (
                      <span className="localizacao-sidebar-active-arrow" aria-hidden="true">
                        ›
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      <div className="localizacao-sidebar-profile flex shrink-0 items-center gap-2 border-t border-sidebar-border p-4">
        <Link
          to="/perfil"
          title={`Abrir perfil de ${profile.nome}`}
          aria-label={`Abrir perfil de ${profile.nome}`}
          className="localizacao-sidebar-profile-link group flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1.5 hover:bg-sidebar-accent"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={`Avatar de ${profile.nome}`}
              className="h-9 w-9 rounded-full border border-operational/40 object-cover"
            />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-operational/40 bg-operational/10 text-xs font-bold text-operational">
              {initial}
            </span>
          )}
          <span className="localizacao-sidebar-profile-copy min-w-0 flex-1">
            <strong className="block truncate text-xs text-sidebar-foreground">
              {profile.nome}
            </strong>
            <span className="block truncate text-[10px] text-muted-foreground">
              {profile.cargo}
            </span>
          </span>
        </Link>
        <button
          type="button"
          onClick={async () => {
            await logout();
            navigate({ to: "/login", replace: true });
          }}
          className="localizacao-sidebar-logout text-muted-foreground transition-colors hover:text-destructive"
          aria-label="Sair"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
      <Link
        to="/modulos"
        title="Sair do módulo"
        aria-label="Sair do módulo"
        className="localizacao-sidebar-exit mx-4 mb-4 inline-flex items-center gap-2 text-[11px] text-muted-foreground hover:text-operational"
      >
        <Undo2 className="h-3.5 w-3.5" />
        <span className="localizacao-sidebar-exit-label">Sair do módulo</span>
      </Link>
    </aside>
  );
}
