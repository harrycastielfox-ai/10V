import { Link, useRouterState } from "@tanstack/react-router";
import { ClipboardList, LayoutDashboard, Plus } from "lucide-react";
import type { UserProfile } from "@/lib/authz";
import { canManageBos } from "@/lib/authz";
import { AppearanceSwitcher } from "./AppearanceSwitcher";
import "@/features/bo/bo.css";

export function BoMobileNavigation({ profile }: { profile: UserProfile }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const overviewActive = pathname === "/bo" || pathname === "/bo/";
  return (
    <>
      <header className="bo-mobile-nav fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-indigo-400/15 px-4 text-white backdrop-blur-xl">
        <Link to="/modulos" className="flex items-center gap-2">
          <span className="sipi-brand-emblem sipi-brand-emblem-bo flex h-10 w-10 shrink-0 items-center justify-center">
            <img
              src="/sipi-logo.png"
              alt=""
              className="sipi-brand-emblem-image h-[92%] w-auto max-w-none object-contain"
            />
          </span>
          <span>
            <strong className="block text-sm font-black">SIPI-B.O</strong>
            <small className="block max-w-40 truncate text-[9px] text-indigo-200/60">
              Boletins de Ocorrência
            </small>
          </span>
        </Link>
        <AppearanceSwitcher />
      </header>
      <nav
        className={`bo-mobile-nav fixed inset-x-0 bottom-0 z-40 grid border-t border-indigo-400/15 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 text-indigo-200 backdrop-blur-xl ${
          canManageBos(profile) ? "grid-cols-3" : "grid-cols-2"
        }`}
      >
        <MobileItem to="/bo" icon={LayoutDashboard} label="Visão geral" active={overviewActive} />
        <MobileItem
          to="/bo/boletins"
          icon={ClipboardList}
          label="Boletins"
          active={!overviewActive && pathname !== "/bo/novo"}
        />
        {canManageBos(profile) ? (
          <MobileItem to="/bo/novo" icon={Plus} label="Novo" active={pathname === "/bo/novo"} />
        ) : null}
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
      className={`flex flex-col items-center gap-1 rounded-lg py-1.5 text-[10px] font-bold ${
        active ? "text-violet-300" : "text-indigo-200/60"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
