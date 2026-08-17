import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bike,
  BusFront,
  Car,
  ChartNoAxesCombined,
  CircleParking,
  FileChartColumn,
  KeyRound,
  LogOut,
  PackageCheck,
  SearchCheck,
  ShieldCheck,
  Siren,
  Truck,
  Undo2,
  Warehouse,
} from "lucide-react";
import { getProfileAvatarPublicUrl, logout } from "@/lib/auth";
import type { UserProfile } from "@/lib/authz";
import { AppearanceSwitcher } from "./AppearanceSwitcher";

const sections = [
  {
    label: "CUSTÓDIA",
    items: [
      { title: "Visão Geral", url: "/veiculos", icon: ChartNoAxesCombined, exact: true },
      { title: "Apreendidos", url: "/veiculos/apreendidos", icon: KeyRound },
      { title: "Recuperados", url: "/veiculos/recuperados", icon: ShieldCheck },
      { title: "Adulterados", url: "/veiculos/adulterados", icon: SearchCheck },
      { title: "Liberados / Devolvidos", url: "/veiculos/liberados", icon: PackageCheck },
      { title: "Relatórios", url: "/veiculos/relatorios", icon: FileChartColumn },
    ],
  },
  {
    label: "VEÍCULOS",
    separated: true,
    items: [
      { title: "Todos os Veículos", url: "/veiculos/todos", icon: CircleParking },
      { title: "Automóveis", url: "/veiculos/automoveis", icon: Car },
      { title: "Motocicletas", url: "/veiculos/motocicletas", icon: Siren },
      { title: "Caminhões", url: "/veiculos/caminhoes", icon: Truck },
      { title: "Ônibus", url: "/veiculos/onibus", icon: BusFront },
      { title: "Bicicletas", url: "/veiculos/bicicletas", icon: Bike },
      { title: "Outros", url: "/veiculos/outros", icon: Warehouse },
    ],
  },
] as const;

export function VehiclesSidebar({ profile }: { profile: UserProfile }) {
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
          <div className="sipi-brand-emblem sipi-brand-emblem-info sipi-brand-emblem-desktop flex h-14 w-14 items-center justify-center">
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
            <div className="-mt-0.5 truncate text-xs text-muted-foreground">
              Veículos Apreendidos
            </div>
          </div>
        </Link>
        <AppearanceSwitcher />
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2">
        {sections.map((section) => (
          <div
            key={section.label}
            className={"separated" in section && section.separated ? "mt-8" : "mt-3 first:mt-0"}
          >
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
