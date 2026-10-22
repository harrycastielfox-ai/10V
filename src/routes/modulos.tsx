import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  FileText,
  Car,
  Package,
  ArrowRight,
  ClipboardList,
  ClipboardCheck,
  Construction,
  LogOut,
  Network,
} from "lucide-react";
import { getCurrentProfile, getProfileAvatarPublicUrl, getSession, logout } from "@/lib/auth";
import { canViewNexo, isAuthorized, type UserProfile } from "@/lib/authz";
import { AppearanceSwitcher } from "@/components/AppearanceSwitcher";

export const Route = createFileRoute("/modulos")({
  head: () => ({
    meta: [
      { title: "Módulos do Sistema — SIED" },
      {
        name: "description",
        content: "Selecione um módulo do Sistema Integrado de Evidências e Dados.",
      },
    ],
  }),
  component: ModulosPage,
});

type ModuloTone = "success" | "info" | "warning" | "report";

interface Modulo {
  id: string;
  titulo: string;
  hint: string;
  descricao: string;
  icon: typeof FileText;
  tone: ModuloTone;
  to?: string;
  disponivel: boolean;
}

const MODULOS: Modulo[] = [
  {
    id: "inqueritos",
    titulo: "PROCEDIMENTOS POLICIAIS",
    hint: "Procedimentos investigativos",
    descricao: "IP, APF, TCO, BOC e AIAI — controle de prazos, situações e equipes.",
    icon: FileText,
    tone: "success",
    to: "/",
    disponivel: true,
  },
  {
    id: "boletim-ocorrencia",
    titulo: "BOLETIM DE OCORRÊNCIA",
    hint: "Registro de ocorrências",
    descricao:
      "Lavratura e consulta de boletins de ocorrência, com histórico do fato, envolvidos e encaminhamentos.",
    icon: ClipboardList,
    tone: "report",
    to: "/bo",
    disponivel: true,
  },
  {
    id: "veiculos",
    titulo: "VEÍCULOS APREENDIDOS",
    hint: "Pátio e custódia",
    descricao: "Registro de veículos apreendidos, vínculo a procedimentos e devoluções.",
    icon: Car,
    tone: "info",
    to: "/veiculos",
    disponivel: true,
  },
  {
    id: "vistorias",
    titulo: "RELATÓRIO DE VISTORIA",
    hint: "Vistoria de veículos",
    descricao:
      "Registre a vistoria do veículo, preserve versões do relatório e mantenha o histórico vinculado ao cadastro.",
    icon: ClipboardCheck,
    tone: "report",
    to: "/vistorias",
    disponivel: true,
  },
  {
    id: "objetos",
    titulo: "OBJETOS APREENDIDOS",
    hint: "Bens, armas e cautelas",
    descricao: "Cadastro e rastreio de objetos apreendidos vinculados a casos.",
    icon: Package,
    tone: "warning",
    to: "/objetos",
    disponivel: true,
  },
  {
    id: "nexo",
    titulo: "NEXO",
    hint: "Inteligência de vínculos",
    descricao:
      "Organizações, pessoas, hipóteses de vínculo, acervo fotográfico, localização e relatórios analíticos.",
    icon: Network,
    tone: "report",
    to: "/nexo",
    disponivel: true,
  },
];

function ModulosPage() {
  const navigate = useNavigate();
  const [aviso, setAviso] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const session = await getSession();
        if (!session) {
          if (!cancelled) navigate({ to: "/login", replace: true });
          return;
        }

        const currentProfile = await getCurrentProfile();
        if (!currentProfile) {
          if (!cancelled)
            navigate({ to: "/login", search: { erro: "profile_missing" } as never, replace: true });
          return;
        }

        if (currentProfile.status_autorizacao === "bloqueado") {
          await logout();
          if (!cancelled)
            navigate({ to: "/login", search: { erro: "access_blocked" } as never, replace: true });
          return;
        }

        if (!isAuthorized(currentProfile)) {
          if (!cancelled) navigate({ to: "/aguardando-autorizacao", replace: true });
          return;
        }

        if (!cancelled) setProfile(currentProfile);
      } catch (error) {
        console.error("[ModulosPage] Falha ao validar sessão/perfil", error);
        if (!cancelled)
          navigate({
            to: "/login",
            search: { erro: "profile_load_failed" } as never,
            replace: true,
          });
      } finally {
        if (!cancelled) setCheckingAuth(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 2800);
    return () => clearTimeout(t);
  }, [aviso]);

  if (checkingAuth) return null;
  if (!profile) return null;
  const avatarUrl = getProfileAvatarPublicUrl(profile.avatar_path);
  const profileInitial = (profile.nome?.trim().charAt(0) || "?").toUpperCase();

  return (
    <div className="sied-modules-shell sied-identity-surface min-h-screen w-full px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-4">
          <h1 className="text-2xl font-bold tracking-wide text-foreground">
            SIED · Módulos do Sistema
          </h1>
          <p className="text-sm text-muted-foreground">
            Selecione um módulo para acessar suas funcionalidades
          </p>
        </div>

        <div className="mb-5 overflow-hidden rounded-xl border border-border bg-card/70 backdrop-blur-sm">
          <div className="sied-brand-line h-px" aria-hidden="true" />
          <div className="px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl border border-primary/30 bg-primary/10 p-1.5 shadow-[0_0_22px_rgba(45,212,191,0.15)]">
                <img
                  src="/sied-mark.svg?v=2"
                  alt="Marca SIED"
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <div className="text-sm font-bold tracking-wide">SIED</div>
                <div className="text-xs text-muted-foreground">DT Itabela — 23ª COORPIN</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <AppearanceSwitcher />
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={`Avatar de ${profile.nome}`}
                  className="h-9 w-9 rounded-full border border-border object-cover"
                />
              ) : (
                <div className="h-9 w-9 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-xs font-bold text-primary">
                  {profileInitial}
                </div>
              )}
              <div className="text-right">
                <div className="text-xs font-semibold">{profile.nome}</div>
                <div className="text-[10px] text-muted-foreground">{profile.cargo}</div>
              </div>
              <button
                onClick={async () => {
                  await logout();
                  navigate({ to: "/login", replace: true });
                }}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-accent transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" /> Sair
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {MODULOS.filter((m) => m.id !== "nexo" || canViewNexo(profile)).map((m) => (
            <ModuloCard
              key={m.id}
              modulo={m}
              onIndisponivel={() =>
                setAviso(`Módulo "${m.titulo}" em breve — sendo criado neste momento.`)
              }
            />
          ))}
        </div>

        {aviso && (
          <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-lg border border-warning/40 bg-card shadow-2xl px-4 py-3 flex items-start gap-3">
            <Construction className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            <div className="text-sm text-foreground">{aviso}</div>
          </div>
        )}
      </div>
    </div>
  );
}

const TONE_STYLES: Record<
  ModuloTone,
  {
    iconBg: string;
    iconBorder: string;
    iconText: string;
    ring: string;
    chip: string;
    rail: string;
  }
> = {
  success: {
    iconBg: "bg-success/15",
    iconBorder: "border-success/30",
    iconText: "text-success",
    ring: "hover:border-success/50 hover:shadow-success/10",
    chip: "bg-success/15 text-success border-success/30",
    rail: "bg-success",
  },
  info: {
    iconBg: "bg-info/15",
    iconBorder: "border-info/30",
    iconText: "text-info",
    ring: "hover:border-info/50 hover:shadow-info/10",
    chip: "bg-info/15 text-info border-info/30",
    rail: "bg-info",
  },
  warning: {
    iconBg: "bg-warning/15",
    iconBorder: "border-warning/30",
    iconText: "text-warning",
    ring: "hover:border-warning/50 hover:shadow-warning/10",
    chip: "bg-warning/15 text-warning border-warning/30",
    rail: "bg-warning",
  },
  report: {
    iconBg: "bg-indigo-500/15",
    iconBorder: "border-indigo-500/40 dark:border-indigo-400/30",
    iconText: "text-indigo-600 dark:text-indigo-300",
    ring: "hover:border-indigo-500/60 hover:shadow-indigo-500/15",
    chip: "bg-indigo-500/15 text-indigo-700 border-indigo-500/40 dark:text-indigo-200 dark:border-indigo-400/30",
    rail: "bg-indigo-500",
  },
};

function ModuloCard({ modulo, onIndisponivel }: { modulo: Modulo; onIndisponivel: () => void }) {
  const Icon = modulo.icon;
  const styles = TONE_STYLES[modulo.tone];
  const cardContent = (
    <div
      className={`group relative flex h-full flex-col overflow-hidden rounded-xl border border-border/90 bg-card/95 p-6 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.5)] ring-1 ring-black/[0.02] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl dark:ring-white/[0.025] ${styles.ring} ${modulo.disponivel ? "cursor-pointer" : "cursor-not-allowed opacity-95"}`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-1 opacity-70 transition-opacity duration-200 group-hover:opacity-100 ${styles.rail}`}
      />
      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div
            className={`h-14 w-14 rounded-xl border ${styles.iconBg} ${styles.iconBorder} flex items-center justify-center`}
          >
            <Icon className={`h-7 w-7 ${styles.iconText}`} />
          </div>
        </div>
        <div
          className={`text-[10px] font-bold tracking-[0.2em] mb-1.5 inline-flex w-fit px-2 py-0.5 rounded border ${styles.chip}`}
        >
          {modulo.hint}
        </div>
        <h3 className="text-lg font-bold tracking-wide mb-2 text-foreground">{modulo.titulo}</h3>
        <p className="text-sm leading-relaxed flex-1 text-muted-foreground">{modulo.descricao}</p>
        <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider uppercase transition-colors text-muted-foreground group-hover:text-foreground">
            {modulo.disponivel ? "Acessar módulo" : "Em desenvolvimento"}
          </span>
          <ArrowRight
            className={`h-4 w-4 ${styles.iconText} transition-all ${modulo.disponivel ? "group-hover:translate-x-1" : "opacity-60"}`}
          />
        </div>
      </div>
    </div>
  );

  if (modulo.disponivel && modulo.to)
    return (
      <Link to={modulo.to} className="group block h-full">
        {cardContent}
      </Link>
    );
  return (
    <button
      type="button"
      onClick={onIndisponivel}
      className="group block h-full text-left w-full cursor-not-allowed focus-visible:outline-none"
    >
      {cardContent}
    </button>
  );
}
