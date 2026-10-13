import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ChartNoAxesCombined, LogOut, Package } from "lucide-react";
import { useState } from "react";
import { getProfileAvatarPublicUrl, logout } from "@/lib/auth";
import type { UserProfile } from "@/lib/authz";
import { AppearanceSwitcher } from "./AppearanceSwitcher";

const items = [
  { title: "Visão Geral", url: "/objetos", icon: ChartNoAxesCombined },
  { title: "Objetos", url: "/objetos/todos", icon: Package },
] as const;

export function ObjectsMobileNavigation({ profile }: { profile: UserProfile }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const avatarUrl = getProfileAvatarPublicUrl(profile.avatar_path);
  const initial = (profile.nome?.trim().charAt(0) || "?").toUpperCase();

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/80 bg-background/95 px-3 backdrop-blur md:hidden">
        <div className="mx-auto flex h-16 max-w-lg items-center justify-between gap-3">
          <Link
            to="/objetos/todos"
            className="flex min-w-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning"
          >
            <span className="sipi-brand-emblem sipi-brand-emblem-warning flex h-10 w-10 items-center justify-center">
              <img
                src="/sied-mark.svg"
                alt=""
                className="sipi-brand-emblem-image h-[92%] w-auto max-w-none object-contain"
              />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-black tracking-wide text-foreground">
                OBJETOS
              </span>
              <span className="block truncate text-[10px] text-muted-foreground">
                Consulta móvel
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-1.5">
            <AppearanceSwitcher />
            <Link
              to="/perfil"
              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-warning/35 bg-warning/10 text-xs font-bold text-warning"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initial
              )}
            </Link>
            <button
              type="button"
              disabled={signingOut}
              onClick={async () => {
                if (signingOut) return;
                setSigningOut(true);
                try {
                  await logout();
                  navigate({ to: "/login", replace: true });
                } finally {
                  setSigningOut(false);
                }
              }}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      <nav
        aria-label="Navegação do módulo de objetos"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="mx-auto grid min-h-16 max-w-lg grid-cols-2 items-stretch">
          {items.map((item) => {
            const active =
              item.url === "/objetos" ? pathname === item.url : pathname.startsWith(item.url);
            const Icon = item.icon;
            return (
              <Link
                key={`${item.url}-${item.title}`}
                to={item.url}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-semibold ${active ? "text-warning" : "text-muted-foreground"}`}
              >
                {active ? (
                  <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-warning" />
                ) : null}
                <Icon className="h-5 w-5" />
                <span className="max-w-full truncate">{item.title}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
