import { Link, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  FileBarChart,
  FileText,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Network,
  Undo2,
  UsersRound,
} from "lucide-react";
import { AppearanceSwitcher } from "@/components/AppearanceSwitcher";
import { getProfileAvatarPublicUrl, logout } from "@/lib/auth";
import type { UserProfile } from "@/lib/authz";

const items = [
  { title: "Painel de inteligência", hash: "painel", icon: LayoutDashboard },
  { title: "Organizações", hash: "organizacoes", icon: Building2 },
  { title: "Pessoas e vínculos", hash: "pessoas", icon: UsersRound },
  { title: "Mapa e rotas", hash: "mapa", icon: MapPinned },
  { title: "Procedimentos", hash: "procedimentos", icon: FileText },
  { title: "Relatórios", hash: "relatorios", icon: FileBarChart },
] as const;

export function NexoSidebar({ profile }: { profile: UserProfile }) {
  const navigate = useNavigate();
  const avatarUrl = getProfileAvatarPublicUrl(profile.avatar_path);
  const initial = (profile.nome?.trim().charAt(0) || "?").toUpperCase();

  return (
    <aside className="nexo-sidebar hidden h-screen w-[248px] shrink-0 flex-col border-r border-cyan-400/15 bg-[#071019] md:sticky md:top-0 md:flex">
      <div className="flex items-center gap-2 border-b border-cyan-400/15 px-4 py-4">
        <Link to="/modulos" className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg">
          <span className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-400/10 text-cyan-300 shadow-[0_0_24px_rgba(34,211,238,.12)]">
            <Network className="h-6 w-6" />
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
          </span>
          <span className="min-w-0">
            <strong className="block text-base font-black tracking-[0.24em] text-white">
              NEXO
            </strong>
            <span className="block truncate text-[10px] uppercase tracking-wider text-cyan-200/55">
              Inteligência de vínculos
            </span>
          </span>
        </Link>
        <AppearanceSwitcher />
      </div>

      <div className="px-5 pb-2 pt-5 text-[9px] font-bold tracking-[0.25em] text-cyan-300/50">
        NÚCLEO OPERACIONAL
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <a
              key={item.hash}
              href={`#${item.hash}`}
              className="group flex min-h-11 items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm text-slate-300 transition-all hover:border-cyan-300/20 hover:bg-cyan-300/5 hover:text-white"
            >
              <Icon className="h-4 w-4 text-cyan-300/65 group-hover:text-cyan-300" />
              <span>{item.title}</span>
            </a>
          );
        })}
      </nav>

      <div className="mx-3 mb-3 rounded-xl border border-amber-300/15 bg-amber-300/5 p-3 text-[10px] leading-relaxed text-amber-100/70">
        Informação de inteligência não equivale a prova. Toda associação deve registrar status,
        confiança e fonte.
      </div>

      <div className="flex items-center gap-2 border-t border-cyan-400/15 p-4">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-300/10 text-xs font-bold text-cyan-200">
            {initial}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-xs text-white">{profile.nome}</strong>
          <span className="block truncate text-[10px] uppercase tracking-wider text-slate-500">
            {profile.cargo}
          </span>
        </span>
        <button
          type="button"
          onClick={async () => {
            await logout();
            navigate({ to: "/login", replace: true });
          }}
          className="text-slate-500 hover:text-red-400"
          aria-label="Sair"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
      <Link
        to="/modulos"
        className="mx-4 mb-4 inline-flex items-center gap-2 text-[11px] text-slate-500 hover:text-cyan-300"
      >
        <Undo2 className="h-3.5 w-3.5" /> Sair do módulo
      </Link>
    </aside>
  );
}
