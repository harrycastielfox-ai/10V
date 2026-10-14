import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { FileText, Gavel, LogOut, Users } from "lucide-react";
import { useState } from "react";
import { getProfileAvatarPublicUrl, logout } from "@/lib/auth";
import { canManageUsers, canViewRepresentacoes, type UserProfile } from "@/lib/authz";
import { AppearanceSwitcher } from "./AppearanceSwitcher";

export function MobileNavigation({ profile }: { profile: UserProfile }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const avatarUrl = getProfileAvatarPublicUrl(profile.avatar_path);
  const initial = (profile.nome?.trim().charAt(0) || "?").toUpperCase();

  const items = [
    { title: "Inquéritos", url: "/inqueritos", icon: FileText, visible: true },
    {
      title: "Representações",
      url: "/representacoes",
      icon: Gavel,
      visible: canViewRepresentacoes(profile),
    },
    {
      title: "Admin",
      url: "/admin/usuarios",
      icon: Users,
      visible: canManageUsers(profile),
    },
  ].filter((item) => item.visible);

  async function handleLogout() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
      navigate({ to: "/login", replace: true });
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/80 bg-background/95 px-3 backdrop-blur md:hidden">
        <div className="mx-auto flex h-16 max-w-lg items-center justify-between gap-3">
          <Link
            to="/inqueritos"
            aria-label="Abrir Inquéritos"
            className="flex min-w-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="sipi-brand-emblem sipi-brand-emblem-primary flex h-10 w-10 shrink-0 items-center justify-center">
              <img
                src="/sied-mark.svg?v=2"
                alt=""
                className="sipi-brand-emblem-image h-[92%] w-auto max-w-none object-contain"
              />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-black tracking-wide text-foreground">SIED</span>
              <span className="block truncate text-[10px] text-muted-foreground">
                Consulta móvel
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-1.5">
            <AppearanceSwitcher />
            <Link
              to="/perfil"
              aria-label={`Abrir perfil de ${profile.nome}`}
              title="Meu perfil"
              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-primary/35 bg-primary/10 text-xs font-bold text-primary"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initial
              )}
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              disabled={signingOut}
              aria-label="Sair"
              title="Sair"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <nav
        aria-label="Navegação principal no celular"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_35px_rgba(0,0,0,0.2)] backdrop-blur md:hidden"
      >
        <div
          className="mx-auto grid min-h-16 max-w-lg items-stretch"
          style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
        >
          {items.map((item) => {
            const active =
              pathname === item.url ||
              pathname.startsWith(`${item.url}/`) ||
              (item.url === "/inqueritos" && pathname === "/novo-caso") ||
              (item.url === "/representacoes" && pathname === "/nova-representacao");
            const Icon = item.icon;

            return (
              <Link
                key={item.url}
                to={item.url}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {active ? (
                  <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary" />
                ) : null}
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="max-w-full truncate">{item.title}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
