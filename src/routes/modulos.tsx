import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  FileText,
  Car,
  Package,
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Construction,
  Shield,
  LogOut,
  Phone,
} from "lucide-react";
import { getCurrentProfile, getProfileAvatarPublicUrl, getSession, logout } from "@/lib/auth";
import { canViewAgenda, canViewLocalizacao, isAuthorized, type UserProfile } from "@/lib/authz";
import { AgendaLembreteNotification } from "@/components/AgendaLembreteNotification";
import { AppearanceSwitcher } from "@/components/AppearanceSwitcher";

export const Route = createFileRoute("/modulos")({
  head: () => ({
    meta: [
      { title: "Módulos do Sistema — SIPI" },
      { name: "description", content: "Selecione um módulo do Sistema de Inquéritos Policiais." },
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
    disponivel: false,
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
    id: "agenda",
    titulo: "AGENDAMENTO",
    hint: "Convocações e horários",
    descricao:
      "Marcação de vítimas, testemunhas e autores para serem ouvidos, com cronograma da unidade.",
    icon: CalendarDays,
    tone: "info",
    to: "/agenda",
    disponivel: true,
  },
  {
    id: "localizacao-operacional",
    titulo: "CONTATO OPERACIONAL",
    hint: "Diligências e rotas",
    descricao:
      "Apoio a diligências externas com cadastro de pessoas, endereços, rotas, chegada ao local, fotos e Street View.",
    icon: Phone,
    tone: "info",
    to: "/localizacao",
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
    <div className="min-h-screen w-full bg-background text-foreground px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-4">
          <h1 className="text-2xl font-bold tracking-wide text-foreground">Módulos do Sistema</h1>
          <p className="text-sm text-muted-foreground">
            Selecione um módulo para acessar suas funcionalidades
          </p>
        </div>

        <div className="mb-5 rounded-xl border border-border bg-card/70 backdrop-blur-sm px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-wide">SIPI</div>
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

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {MODULOS.filter(
            (m) =>
              (m.id !== "localizacao-operacional" || canViewLocalizacao(profile)) &&
              (m.id !== "agenda" || canViewAgenda(profile)),
          ).map((m) => (
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

        {/* É aqui que o servidor cai logo depois de entrar — o lembrete da
            agenda precisa aparecer nesta tela, não só dentro dos módulos. */}
        {canViewAgenda(profile) && !aviso ? <AgendaLembreteNotification /> : null}
      </div>
    </div>
  );
}

const TONE_STYLES: Record<
  ModuloTone,
  { iconBg: string; iconBorder: string; iconText: string; ring: string; chip: string }
> = {
  success: {
    iconBg: "bg-success/15",
    iconBorder: "border-success/30",
    iconText: "text-success",
    ring: "hover:border-success/50 hover:shadow-success/10",
    chip: "bg-success/15 text-success border-success/30",
  },
  info: {
    iconBg: "bg-info/15",
    iconBorder: "border-info/30",
    iconText: "text-info",
    ring: "hover:border-info/50 hover:shadow-info/10",
    chip: "bg-info/15 text-info border-info/30",
  },
  warning: {
    iconBg: "bg-warning/15",
    iconBorder: "border-warning/30",
    iconText: "text-warning",
    ring: "hover:border-warning/50 hover:shadow-warning/10",
    chip: "bg-warning/15 text-warning border-warning/30",
  },
  report: {
    iconBg: "bg-indigo-500/12",
    iconBorder: "border-indigo-400/25",
    iconText: "text-indigo-300/90",
    ring: "",
    chip: "bg-indigo-500/12 text-indigo-100/85 border-indigo-300/25",
  },
};

function ModuloCard({ modulo, onIndisponivel }: { modulo: Modulo; onIndisponivel: () => void }) {
  const Icon = modulo.icon;
  const styles = TONE_STYLES[modulo.tone];
  const isBoletim = modulo.id === "boletim-ocorrencia";
  const cardContent = (
    <div
      className={`group relative h-full overflow-hidden rounded-xl border p-6 flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl ${styles.ring} ${
        isBoletim
          ? "border-border bg-card shadow-[0_0_16px_rgba(129,140,248,0.03),inset_0_1px_0_rgba(255,255,255,0.025)] group-hover:border-indigo-400/45 group-focus-visible:border-indigo-400/45 group-hover:shadow-[0_0_24px_rgba(129,140,248,0.16),inset_0_1px_0_rgba(255,255,255,0.05)] group-focus-visible:shadow-[0_0_24px_rgba(129,140,248,0.16),inset_0_1px_0_rgba(255,255,255,0.05)]"
          : "border-border bg-card"
      } ${modulo.disponivel ? "cursor-pointer" : "cursor-not-allowed opacity-95"}`}
    >
      {isBoletim && <BoletimBackdrop />}

      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div
            className={`h-14 w-14 rounded-xl border ${styles.iconBg} ${styles.iconBorder} flex items-center justify-center ${
              isBoletim
                ? "transition-all duration-200 group-hover:border-indigo-300/40 group-focus-visible:border-indigo-300/40 group-hover:bg-indigo-400/15 group-focus-visible:bg-indigo-400/15 group-hover:shadow-[0_0_14px_rgba(129,140,248,0.16)] group-focus-visible:shadow-[0_0_14px_rgba(129,140,248,0.16)]"
                : ""
            }`}
          >
            <Icon
              className={`h-7 w-7 ${styles.iconText} ${
                isBoletim
                  ? "transition-all duration-200 group-hover:text-indigo-200 group-focus-visible:text-indigo-200 group-hover:drop-shadow-[0_0_8px_rgba(129,140,248,0.28)] group-focus-visible:drop-shadow-[0_0_8px_rgba(129,140,248,0.28)]"
                  : ""
              }`}
            />
          </div>
        </div>
        <div
          className={`text-[10px] font-bold tracking-[0.2em] mb-1.5 inline-flex w-fit px-2 py-0.5 rounded border ${styles.chip}`}
        >
          {modulo.hint}
        </div>
        <h3 className="text-lg font-bold tracking-wide text-foreground mb-2">{modulo.titulo}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed flex-1">{modulo.descricao}</p>
        <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider uppercase text-muted-foreground group-hover:text-foreground transition-colors">
            {modulo.disponivel ? "Acessar módulo" : "Em desenvolvimento"}
          </span>
          <ArrowRight
            className={`h-4 w-4 ${styles.iconText} transition-all ${
              modulo.disponivel ? "group-hover:translate-x-1" : "opacity-60"
            } ${
              isBoletim
                ? "group-hover:text-indigo-200 group-focus-visible:text-indigo-200 group-hover:drop-shadow-[0_0_6px_rgba(129,140,248,0.24)] group-focus-visible:drop-shadow-[0_0_6px_rgba(129,140,248,0.24)]"
                : ""
            }`}
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

function BoletimBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_16%,rgba(129,140,248,0.05),transparent_38%),radial-gradient(circle_at_12%_88%,rgba(99,102,241,0.035),transparent_34%),linear-gradient(135deg,rgba(2,6,23,0.28),rgba(30,27,75,0.05)_52%,rgba(2,6,23,0.66))] opacity-90 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100" />
      <svg
        className="absolute inset-0 h-full w-full opacity-40 transition-opacity duration-200 group-hover:opacity-60 group-focus-visible:opacity-60"
        viewBox="0 0 420 260"
        preserveAspectRatio="none"
        role="presentation"
      >
        <defs>
          <filter id="boletim-stamp-glow" x="-70%" y="-70%" width="240%" height="240%">
            <feGaussianBlur stdDeviation="2.6" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="0 0 0 0 0.51 0 0 0 0 0.55 0 0 0 0 0.97 0 0 0 0.40 0"
            />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* folha de trás, sugerindo pilha de registros */}
        <rect
          x="212"
          y="52"
          width="140"
          height="188"
          rx="6"
          transform="rotate(-13 282 146)"
          fill="rgba(99,102,241,0.012)"
          stroke="rgba(129,140,248,0.045)"
          strokeWidth="1"
        />

        {/* folha do boletim, levemente inclinada */}
        <g transform="rotate(-7 300 130)">
          <rect
            x="238"
            y="26"
            width="150"
            height="200"
            rx="6"
            fill="rgba(129,140,248,0.022)"
            stroke="rgba(129,140,248,0.09)"
            strokeWidth="1"
            className="transition-all duration-200 group-hover:stroke-[rgba(129,140,248,0.18)] group-focus-visible:stroke-[rgba(129,140,248,0.18)]"
          />
          {/* cabeçalho */}
          <rect x="256" y="44" width="58" height="6" rx="3" fill="rgba(165,180,252,0.13)" />
          <rect x="256" y="56" width="94" height="4" rx="2" fill="rgba(148,163,184,0.07)" />
          <line x1="256" y1="70" x2="370" y2="70" stroke="rgba(129,140,248,0.08)" strokeWidth="1" />
          {/* linhas do relato */}
          <g fill="rgba(148,163,184,0.06)">
            <rect x="256" y="82" width="114" height="4" rx="2" />
            <rect x="256" y="94" width="100" height="4" rx="2" />
            <rect x="256" y="106" width="110" height="4" rx="2" />
            <rect x="256" y="118" width="78" height="4" rx="2" />
            <rect x="256" y="136" width="114" height="4" rx="2" />
            <rect x="256" y="148" width="92" height="4" rx="2" />
            <rect x="256" y="160" width="106" height="4" rx="2" />
            <rect x="256" y="172" width="64" height="4" rx="2" />
          </g>
          {/* linha de assinatura */}
          <line
            x1="256"
            y1="204"
            x2="332"
            y2="204"
            stroke="rgba(148,163,184,0.10)"
            strokeWidth="1"
          />
          <path
            d="M260 200 c8 -8 12 6 19 -2 s9 5 15 -3 s10 6 16 -1"
            fill="none"
            stroke="rgba(165,180,252,0.13)"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          {/* carimbo */}
          <g filter="url(#boletim-stamp-glow)">
            <circle
              cx="352"
              cy="192"
              r="19"
              fill="none"
              stroke="rgba(129,140,248,0.14)"
              strokeWidth="2"
              className="transition-all duration-200 group-hover:stroke-[rgba(129,140,248,0.26)] group-focus-visible:stroke-[rgba(129,140,248,0.26)]"
            />
            <circle
              cx="352"
              cy="192"
              r="13"
              fill="none"
              stroke="rgba(165,180,252,0.10)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <rect x="343" y="189" width="18" height="3" rx="1.5" fill="rgba(165,180,252,0.14)" />
          </g>
        </g>
      </svg>
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/86 via-slate-950/66 to-slate-950/40" />
      <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/5" />
    </div>
  );
}
