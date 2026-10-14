import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ClipboardList, Clock3, LayoutDashboard, LogOut, Undo2 } from "lucide-react";
import { AppearanceSwitcher } from "./AppearanceSwitcher";
import { getProfileAvatarPublicUrl, logout } from "@/lib/auth";
import type { UserProfile } from "@/lib/authz";

export function BoSidebar({ profile }: { profile: UserProfile }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const avatarUrl = getProfileAvatarPublicUrl(profile.avatar_path);
  const initial = (profile.nome?.trim().charAt(0) || "?").toUpperCase();
  const overviewActive = pathname === "/bo" || pathname === "/bo/";
  const boletinsActive = !overviewActive;

  const handleLogout = async () => {
    await logout();
    navigate({ to: "/login" });
  };

  return (
    <aside className="hidden h-screen w-[260px] shrink-0 flex-col border-r border-white/10 bg-[#07090d] text-zinc-100 md:sticky md:top-0 md:flex">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
        <Link
          to="/modulos"
          className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple"
          aria-label="Voltar aos módulos"
        >
          <span className="sipi-brand-emblem sipi-brand-emblem-bo sipi-brand-emblem-desktop flex h-14 w-14 shrink-0 items-center justify-center">
            <img
              src="/sied-mark.svg?v=2"
              alt="Logo SIED-B.O"
              className="sipi-brand-emblem-image h-[92%] w-auto object-contain"
            />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-bold tracking-wide text-zinc-100 transition-colors group-hover:text-purple-300">
              SIED-B.O
            </div>
            <div className="-mt-0.5 truncate text-xs text-zinc-500">Módulo de Boletins</div>
          </div>
        </Link>
        <AppearanceSwitcher />
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-3">
        <div className="mb-1.5 px-2 text-[10px] font-semibold tracking-[0.2em] text-zinc-500">
          OPERAÇÃO
        </div>
        <div className="space-y-1">
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
          <SidebarItem
            to="/bo/boletins"
            search={{ q: "Em andamento" }}
            label="Andamentos"
            icon={Clock3}
          />
        </div>
      </nav>

      <div className="flex shrink-0 items-center gap-2 border-t border-white/10 p-4">
        <Link
          to="/perfil"
          className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-purple/15"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={`Avatar de ${profile.nome}`}
              className="h-9 w-9 rounded-full border border-purple/40 object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-purple/40 bg-purple/15 text-xs font-bold text-purple">
              {initial}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold text-zinc-100 group-hover:text-purple-200">
              {profile.nome}
            </div>
            <div className="truncate text-[10px] text-zinc-500">
              {profile.cargo || "sessão ativa"}
            </div>
          </div>
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="text-zinc-500 transition-colors hover:text-purple-300"
          aria-label="Sair"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
      <Link
        to="/modulos"
        className="mx-4 mb-4 inline-flex items-center gap-2 text-[11px] text-zinc-500 transition-colors hover:text-purple-300"
      >
        <Undo2 className="h-3.5 w-3.5" /> Sair do módulo
      </Link>
    </aside>
  );
}

function SidebarItem({
  to,
  label,
  icon: Icon,
  active,
  search,
}: {
  to: "/bo" | "/bo/boletins";
  label: string;
  icon: typeof LayoutDashboard;
  active?: boolean;
  search?: { q: string };
}) {
  return (
    <Link
      to={to}
      search={search as never}
      className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
        active
          ? "border-purple/55 bg-purple/20 text-purple-200"
          : "border-transparent text-zinc-300 hover:border-purple/25 hover:bg-purple/15 hover:text-purple-200"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate font-semibold">{label}</span>
      {active ? <span aria-hidden="true">›</span> : null}
    </Link>
  );
}
