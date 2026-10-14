import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  FileText,
  Bell,
  LogOut,
  Gavel,
  Users,
  ClipboardList,
  BarChart3,
} from "lucide-react";
import { getProfileAvatarPublicUrl, logout } from "@/lib/auth";
import {
  canManageUsers,
  canViewAuditoria,
  canViewRepresentacoes,
  type UserProfile,
} from "@/lib/authz";
import { buildOperationalModuleAlerts, countModuleAlertsTotal } from "@/lib/alertasInteligentes";
import { listInqueritos } from "@/lib/repositories/inqueritosRepository";
import { listRepresentacoes } from "@/lib/repositories/representacoesRepository";
import { AppearanceSwitcher } from "./AppearanceSwitcher";

const baseItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Procedimentos Policiais", url: "/inqueritos", icon: FileText },
  { title: "Movimentações Processuais", url: "/representacoes", icon: Gavel },
  { title: "Estatísticas", url: "/estatisticas", icon: BarChart3 },
  { title: "Alertas", url: "/alertas", icon: Bell },
  { title: "Auditoria", url: "/auditoria", icon: ClipboardList },
] as const;

export function AppSidebar({ profile }: { profile: UserProfile }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [alertasBadge, setAlertasBadge] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [inqueritos, representacoes] = await Promise.all([
          listInqueritos(),
          listRepresentacoes(),
        ]);
        if (!cancelled) {
          setAlertasBadge(
            countModuleAlertsTotal(buildOperationalModuleAlerts(inqueritos, representacoes)),
          );
        }
      } catch {
        if (!cancelled) {
          setAlertasBadge(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleBaseItems = baseItems.filter((item) => {
    if (item.url === "/representacoes") return canViewRepresentacoes(profile);
    if (item.url === "/auditoria") return canViewAuditoria(profile);
    return true;
  });
  const itemsWithAlertasBadge = visibleBaseItems.map((item) =>
    item.url === "/alertas" && alertasBadge !== null ? { ...item, badge: alertasBadge } : item,
  );
  const items = canManageUsers(profile)
    ? [...itemsWithAlertasBadge, { title: "Admin Usuários", url: "/admin/usuarios", icon: Users }]
    : itemsWithAlertasBadge;
  const avatarUrl = getProfileAvatarPublicUrl(profile.avatar_path);
  const initial = (profile.nome?.trim().charAt(0) || "?").toUpperCase();

  async function handleLogout() {
    await logout();
    navigate({ to: "/login" });
  }

  return (
    <aside className="hidden md:sticky md:top-0 md:flex h-screen w-64 shrink-0 flex-col bg-sidebar border-r border-sidebar-border">
      <div className="flex items-center gap-3 border-b border-sidebar-border/90 px-5 py-5">
        <Link
          to="/modulos"
          aria-label="Voltar aos módulos"
          title="Voltar aos módulos"
          className="sipi-brand-link group flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="sipi-brand-emblem sipi-brand-emblem-primary sipi-brand-emblem-desktop flex h-14 w-14 items-center justify-center">
            <img
              src="/sied-mark.svg?v=2"
              alt="Logo SIED"
              className="sipi-brand-emblem-image h-[92%] w-auto shrink-0 object-contain"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold tracking-wide text-sidebar-foreground transition-colors group-hover:text-primary">
              SIED
            </div>
            <div className="-mt-0.5 truncate text-xs text-muted-foreground">
              Procedimentos Policiais
            </div>
          </div>
        </Link>
        <AppearanceSwitcher />
      </div>

      <div className="px-5 mt-4 mb-2 text-[10px] tracking-[0.2em] text-muted-foreground font-semibold">
        MÓDULOS
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3">
        {items.map((item) => {
          const active = pathname === item.url;
          const Icon = item.icon;
          return (
            <Link
              key={item.url}
              to={item.url}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{item.title}</span>
              {"badge" in item ? (
                <span className="text-[10px] font-semibold bg-destructive/20 text-destructive px-1.5 py-0.5 rounded">
                  {Number(item.badge)}
                </span>
              ) : null}
              {active && <span className="text-primary">›</span>}
            </Link>
          );
        })}
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
            <div className="h-9 w-9 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-xs font-bold text-primary">
              {initial}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-sidebar-foreground truncate">
              {profile.nome}
            </div>
            <div className="text-[10px] text-muted-foreground truncate">{profile.cargo}</div>
          </div>
        </Link>
        <button
          onClick={handleLogout}
          className="text-muted-foreground hover:text-destructive transition-colors"
          aria-label="Sair"
          title="Sair"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
      <div className="shrink-0 px-4 pb-3 text-[10px] text-muted-foreground">
        v2.0.0 · SIED © 2026
      </div>
    </aside>
  );
}
