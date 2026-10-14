import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ClipboardList, LayoutDashboard, LogOut, Plus } from "lucide-react";
import { useState } from "react";
import type { UserProfile } from "@/lib/authz";
import { canManageBos } from "@/lib/authz";
import { getProfileAvatarPublicUrl, logout } from "@/lib/auth";
import { AppearanceSwitcher } from "./AppearanceSwitcher";

export function BoMobileNavigation({ profile }: { profile: UserProfile }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const overviewActive = pathname === "/bo" || pathname === "/bo/";
  const avatarUrl = getProfileAvatarPublicUrl(profile.avatar_path);
  const initial = (profile.nome?.trim().charAt(0) || "?").toUpperCase();

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b border-border/80 bg-background/95 px-3 backdrop-blur md:hidden">
        <div className="mx-auto flex h-16 max-w-lg items-center justify-between gap-3">
          <Link to="/bo" className="flex min-w-0 items-center gap-2">
            <span className="sipi-brand-emblem sipi-brand-emblem-bo flex h-10 w-10 shrink-0 items-center justify-center">
              <img
                src="/sied-mark.svg?v=2"
                alt=""
                className="sipi-brand-emblem-image h-[92%] w-auto max-w-none object-contain"
              />
            </span>
            <span className="min-w-0">
              <strong className="block text-sm font-black text-foreground">SIED</strong>
              <small className="block max-w-40 truncate text-[9px] text-muted-foreground">
                System Protect
              </small>
            </span>
          </Link>
          <div className="flex items-center gap-1.5">
            <AppearanceSwitcher />
            <Link
              to="/perfil"
              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-purple/35 bg-purple/10 text-xs font-bold text-purple"
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
        aria-label="Navegação do módulo de boletins"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div
          className={`mx-auto grid min-h-16 max-w-lg items-stretch ${
            canManageBos(profile) ? "grid-cols-3" : "grid-cols-2"
          }`}
        >
          <MobileItem
            to="/bo"
            icon={LayoutDashboard}
            label="Visão geral"
            active={overviewActive}
          />
          <MobileItem
            to="/bo/boletins"
            icon={ClipboardList}
            label="Boletins"
            active={!overviewActive && pathname !== "/bo/novo"}
          />
          {canManageBos(profile) ? (
            <MobileItem to="/bo/novo" icon={Plus} label="Novo" active={pathname === "/bo/novo"} />
          ) : null}
        </div>
      </nav>
    </>
  );
}

function MobileItem({
  to,
  icon: Icon,
  label,
  active,
}: {
  to: "/bo" | "/bo/boletins" | "/bo/novo";
  icon: typeof LayoutDashboard;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={`relative flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-semibold ${
        active ? "text-purple" : "text-muted-foreground"
      }`}
    >
      {active ? <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-purple" /> : null}
      <Icon className="h-5 w-5" />
      <span className="max-w-full truncate">{label}</span>
    </Link>
  );
}
