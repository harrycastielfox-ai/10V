import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ClipboardList, LayoutDashboard, LogOut } from "lucide-react";
import { AppearanceSwitcher } from "./AppearanceSwitcher";
import { getProfileAvatarPublicUrl, logout } from "@/lib/auth";
import type { UserProfile } from "@/lib/authz";
import "@/features/bo/bo.css";

export function BoSidebar({ profile }: { profile: UserProfile }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const avatarUrl = getProfileAvatarPublicUrl(profile.avatar_path);
  const initial = (profile.nome?.trim().charAt(0) || "E").toUpperCase();
  const overviewActive = pathname === "/bo" || pathname === "/bo/";
  const boletinsActive = !overviewActive;

  const handleLogout = async () => {
    await logout();
    navigate({ to: "/login" });
  };

  return (
    <aside className="bo-sidebar hidden h-screen w-64 shrink-0 flex-col border-r md:sticky md:top-0 md:flex">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
        <Link
          to="/modulos"
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
          aria-label="Voltar aos módulos"
        >
          <span className="sipi-brand-emblem sipi-brand-emblem-bo sipi-brand-emblem-desktop flex h-14 w-14 shrink-0 items-center justify-center">
            <img
              src="/sipi-logo.png"
              alt="Logo SIPI-B.O"
              className="sipi-brand-emblem-image h-[92%] w-auto object-contain"
            />
          </span>
          <span className="min-w-0">
            <strong className="block text-base font-black tracking-wide text-white">SIPI-B.O</strong>
            <small className="block truncate text-[9px] uppercase tracking-[0.12em] text-indigo-200/60">
              Módulo de Boletins
            </small>
          </span>
        </Link>
        <AppearanceSwitcher />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
        <p className="px-3 text-[9px] font-black uppercase tracking-[0.18em] text-indigo-200/40">
          Operação
        </p>
        <nav className="mt-2 space-y-1">
          <SidebarItem
            to="/bo"
            label="Visão geral"
            icon={LayoutDashboard}
            active={overviewActive}
          />
          <SidebarItem
            to="/bo/boletins"
            label="Boletins de Ocorrência"
            icon={ClipboardList}
            active={boletinsActive}
          />
        </nav>

      </div>

      <div className="m-4 mt-auto flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="size-9 rounded-full object-cover" />
        ) : (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-500 text-xs font-black text-white">
            {initial}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-xs text-white">{profile.nome}</strong>
          <small className="block truncate text-[9px] text-violet-200/70">
            {profile.cargo || "sessão ativa"}
          </small>
        </span>
        <button
          type="button"
          onClick={handleLogout}
          className="text-violet-200/70 transition hover:text-red-300"
          aria-label="Sair"
          title="Sair"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}

function SidebarItem({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: "/bo" | "/bo/boletins";
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={`bo-sidebar-item flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
        active ? "bo-sidebar-item-active" : ""
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate font-semibold">{label}</span>
    </Link>
  );
}
