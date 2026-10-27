import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Clock3, LogOut, ShieldCheck, Sparkles, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentProfile, getSession, logout } from "@/lib/auth";
import { isAuthorized } from "@/lib/authz";
import { getPostAuthDestination } from "@/lib/mobileExperience";

export const Route = createFileRoute("/aguardando-autorizacao")({
  component: PendingAuthorizationPage,
});

/** De quanto em quanto tempo confere se já liberaram o acesso, sem exigir F5. */
const INTERVALO_VERIFICACAO_MS = 10_000;

function PendingAuthorizationPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    let verificationPending = false;

    async function verificar() {
      if (cancelled || verificationPending) return;
      verificationPending = true;

      try {
        const session = await getSession();
        if (!session) {
          if (!cancelled) navigate({ to: "/login", replace: true });
          return;
        }

        const profile = await getCurrentProfile();
        if (!profile) {
          if (!cancelled)
            navigate({ to: "/login", search: { erro: "profile_missing" } as never, replace: true });
          return;
        }
        if (profile.status_autorizacao === "bloqueado") {
          await logout();
          if (!cancelled)
            navigate({ to: "/login", search: { erro: "access_blocked" } as never, replace: true });
          return;
        }
        if (isAuthorized(profile)) {
          if (!cancelled) navigate({ to: getPostAuthDestination(), replace: true });
        }
      } catch {
        if (!cancelled)
          navigate({
            to: "/login",
            search: { erro: "profile_load_failed" } as never,
            replace: true,
          });
      } finally {
        verificationPending = false;
      }
    }

    void verificar();
    const intervalo = window.setInterval(() => void verificar(), INTERVALO_VERIFICACAO_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalo);
    };
  }, [navigate]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground">
      <style>{`
        .pending-auth-card {
          animation: pendingAuthEnter 620ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        .pending-auth-orbit {
          animation: pendingAuthOrbit 9s linear infinite;
        }

        .pending-auth-sheen {
          animation: pendingAuthSheen 4s ease-in-out infinite;
          mix-blend-mode: screen;
        }

        .pending-auth-pulse {
          animation: pendingAuthPulse 1.9s ease-in-out infinite;
        }

        .pending-auth-dot {
          animation: pendingAuthDot 1.1s ease-in-out infinite;
        }

        .pending-auth-dot:nth-child(2) {
          animation-delay: 220ms;
        }

        .pending-auth-dot:nth-child(3) {
          animation-delay: 440ms;
        }

        @keyframes pendingAuthEnter {
          0% {
            opacity: 0;
            transform: translateY(18px) scale(0.97);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes pendingAuthOrbit {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes pendingAuthSheen {
          0%, 32% {
            transform: translateX(-130%) rotate(12deg);
            opacity: 0;
          }
          44% {
            opacity: 0.58;
          }
          62% {
            transform: translateX(620%) rotate(12deg);
            opacity: 0;
          }
          100% {
            transform: translateX(620%) rotate(12deg);
            opacity: 0;
          }
        }

        @keyframes pendingAuthPulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.22);
          }
          50% {
            box-shadow: 0 0 0 18px rgba(34, 197, 94, 0);
          }
        }

        @keyframes pendingAuthDot {
          0%, 100% {
            opacity: 0.35;
            transform: translateY(0);
          }
          50% {
            opacity: 1;
            transform: translateY(-4px);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .pending-auth-card,
          .pending-auth-orbit,
          .pending-auth-sheen,
          .pending-auth-pulse,
          .pending-auth-dot {
            animation: none !important;
          }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-[-18rem] h-[36rem] w-[36rem] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -right-48 bottom-[-20rem] h-[42rem] w-[42rem] rounded-full bg-success/10 blur-3xl" />
        <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
      </div>

      <section className="pending-auth-card relative w-full max-w-3xl overflow-hidden rounded-[2rem] border border-primary/25 bg-card/95 p-8 text-center shadow-[0_35px_120px_rgba(0,0,0,0.58),0_0_55px_rgba(34,197,94,0.1)] sm:p-10">
        <span
          className="pending-auth-sheen pointer-events-none absolute inset-y-[-35%] left-[-70%] z-0 w-1/3 rotate-12 bg-gradient-to-r from-transparent via-white/20 to-transparent blur-sm"
          aria-hidden="true"
        />

        <div className="relative z-10 mx-auto flex w-fit items-center justify-center">
          <div className="pending-auth-orbit absolute h-44 w-44 rounded-full border border-primary/10 border-t-primary/45" />
          <img
            src="/sied-mark.svg?v=2"
            alt="Logo SIED"
            className="relative h-32 w-32 object-contain drop-shadow-[0_0_24px_rgba(34,197,94,0.18)]"
          />
        </div>

        <div className="pending-auth-pulse relative z-10 mx-auto mt-8 flex h-16 w-16 items-center justify-center rounded-full border border-primary/30 bg-primary/15 text-primary">
          <ShieldCheck className="h-8 w-8" aria-hidden="true" />
        </div>

        <p className="relative z-10 mt-6 flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-[0.3em] text-primary">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Solicitação em análise
        </p>
        <h1 className="relative z-10 mt-3 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
          Sua conta aguarda autorização
        </h1>
        <p className="relative z-10 mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
          Seu cadastro foi recebido com sucesso. A liberação de acesso será concluída por um
          administrador autorizado antes da entrada nos módulos do SIED.
        </p>

        <div className="relative z-10 mt-8 grid gap-3 text-left sm:grid-cols-3">
          <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
            <div className="flex items-center gap-2 text-primary">
              <UserCheck className="h-4 w-4" aria-hidden="true" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Cadastro</span>
            </div>
            <p className="mt-2 text-sm font-bold text-foreground">Registrado</p>
          </div>
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4">
            <div className="flex items-center gap-2 text-amber-300">
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Status</span>
            </div>
            <p className="mt-2 text-sm font-bold text-foreground">Aguardando liberação</p>
          </div>
          <div className="rounded-2xl border border-sky-400/20 bg-sky-400/5 p-4">
            <div className="flex items-center gap-2 text-sky-300">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Segurança</span>
            </div>
            <p className="mt-2 text-sm font-bold text-foreground">Acesso restrito</p>
          </div>
        </div>

        <div className="relative z-10 mt-8 flex flex-wrap items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
          <span>Aguardando validação institucional</span>
          <span className="pending-auth-dot h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="pending-auth-dot h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="pending-auth-dot h-1.5 w-1.5 rounded-full bg-primary" />
        </div>

        <Button
          className="relative z-10 mt-8 gap-2 rounded-full border border-primary/25 bg-primary/10 px-6 py-5 text-primary hover:bg-primary/15"
          variant="outline"
          onClick={async () => {
            await logout();
            navigate({ to: "/login", replace: true });
          }}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sair e voltar ao login
        </Button>
      </section>
    </div>
  );
}
