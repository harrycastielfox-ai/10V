import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  authenticateWithLoginOrEmail,
  AuthFlowError,
  getCurrentProfile,
  getSession,
  logout,
} from "@/lib/auth";
import { isAuthorized } from "@/lib/authz";
import { getPostAuthDestination } from "@/lib/mobileExperience";
import {
  AccessContextError,
  captureNetworkAccessContext,
  registerOwnAccessContext,
} from "@/lib/accessContext";

const LOGIN_SPLASH_KEY = "sipi:login-splash-shown";
const LOGIN_SPLASH_DURATION_MS = 2200;

const POST_SIGNUP_LOGIN_KEY = "sipi:post-signup-login";
const POST_SIGNUP_MESSAGE =
  "Conta criada com sucesso. Aguarde autorização de um administrador para acessar o SIED.";

const PASSWORD_RECOVERY_WHATSAPP_NUMBER = "5573981907374";
const PASSWORD_RECOVERY_WHATSAPP_MESSAGE =
  "Olá, infelizmente esqueci ou perdi minha senha do SIED, vou fornecer meu e-mail e nome para recuperar minha senha.";
const PASSWORD_RECOVERY_WHATSAPP_URL = `https://wa.me/${PASSWORD_RECOVERY_WHATSAPP_NUMBER}?text=${encodeURIComponent(PASSWORD_RECOVERY_WHATSAPP_MESSAGE)}`;

const PROFILE_RETRY_DELAYS_MS = [0, 200, 500, 900];

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function clearLoginErrorQueryParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("erro")) return;
  url.searchParams.delete("erro");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

async function getCurrentProfileWithRetry() {
  let lastError: unknown = null;

  for (const delay of PROFILE_RETRY_DELAYS_MS) {
    if (delay > 0) await sleep(delay);

    try {
      const profile = await getCurrentProfile();
      if (profile) return profile;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) throw lastError;
  return null;
}
function registerAccessContextInBackground() {
  return registerOwnAccessContext()
    .then(() => captureNetworkAccessContext())
    .catch((error) => {
      if (error instanceof AccessContextError && error.code === "UNAVAILABLE") return;
      if (import.meta.env.DEV) {
        console.warn("[login] Não foi possível registrar o contexto do acesso.");
      }
    });
}

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Acesso Restrito — SIED" },
      { name: "description", content: "Tela de autenticação do Sistema Integrado de Evidências e Dados." },
    ],
  }),
  component: LoginPage,
});

function getFriendlyLoginError(err: unknown): string {
  const errorLike = err as { message?: string; cause?: { message?: string } };
  const msg = String(errorLike.message || errorLike.cause?.message || "").toLowerCase();

  if (err instanceof AuthFlowError) {
    if (err.code === "PROFILE_NOT_FOUND")
      return "Autenticação concluída, mas o perfil não foi encontrado.";
    if (err.code === "PROFILE_RLS_DENIED")
      return "Seu perfil existe, mas a policy (RLS) bloqueou a leitura.";
    if (err.code === "PROFILE_FETCH_FAILED")
      return "Autenticação concluída, mas houve falha ao carregar o perfil.";
    if (err.code === "AUTH_RATE_LIMITED")
      return "Muitas tentativas de login. Aguarde alguns minutos e tente novamente.";
    if (err.code === "AUTH_EMAIL_NOT_CONFIRMED")
      return "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.";
    if (err.code === "AUTH_SERVICE_UNAVAILABLE")
      return "O serviço de login está temporariamente indisponível. Tente novamente em instantes.";
    if (err.code === "AUTH_INVALID_CREDENTIALS") return "Usuário/e-mail ou senha inválidos.";
  }

  if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
    return "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.";
  }

  if (msg.includes("too many requests") || msg.includes("over_request_rate_limit")) {
    return "Muitas tentativas de login. Aguarde alguns minutos e tente novamente.";
  }

  if (
    msg.includes("invalid login credentials") ||
    msg.includes("invalid grant") ||
    msg.includes("invalid login")
  ) {
    return "Usuário/e-mail ou senha inválidos.";
  }

  return "Falha no login. Verifique suas credenciais e permissões.";
}

function readPostSignupLogin() {
  try {
    const raw = sessionStorage.getItem(POST_SIGNUP_LOGIN_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(POST_SIGNUP_LOGIN_KEY);
    const parsed = JSON.parse(raw) as { login?: unknown; message?: unknown };
    return {
      login: typeof parsed.login === "string" ? parsed.login : "",
      message:
        typeof parsed.message === "string" && parsed.message.trim()
          ? parsed.message
          : POST_SIGNUP_MESSAGE,
    };
  } catch (error) {
    console.warn("[LoginPage] Não foi possível ler dados temporários pós-cadastro", error);
    sessionStorage.removeItem(POST_SIGNUP_LOGIN_KEY);
    return null;
  }
}

function PostSignupWelcomeOverlay({ message }: { message: string }) {
  return (
    <div className="post-signup-welcome fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-background/96 px-4 text-foreground backdrop-blur-md">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/10" />
        <div className="absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/15" />
        <div className="absolute left-1/2 top-1/2 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      </div>

      <section className="post-signup-welcome-card relative w-full max-w-xl overflow-hidden rounded-3xl border border-primary/25 bg-card/95 p-8 text-center shadow-[0_30px_100px_rgba(0,0,0,0.55),0_0_48px_rgba(34,197,94,0.12)]">
        <span
          className="post-signup-panel-sheen pointer-events-none absolute inset-y-[-35%] left-[-70%] z-0 w-1/3 rotate-12 bg-gradient-to-r from-transparent via-white/20 to-transparent blur-sm"
          aria-hidden="true"
        />

        <div className="relative z-10 mx-auto h-36 w-36 overflow-hidden drop-shadow-[0_0_30px_rgba(34,197,94,0.2)]">
          <img src="/sied-mark.svg?v=2" alt="Logo SIED" className="h-full w-full object-contain" />
        </div>

        <div
          className="relative z-10 mx-auto mt-4 h-1.5 w-56 overflow-hidden rounded-full border border-primary/15 bg-primary/10 shadow-[0_0_18px_rgba(34,197,94,0.12)]"
          aria-hidden="true"
        >
          <span className="post-signup-loading-bar absolute inset-y-0 left-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_14px_rgba(34,197,94,0.55)]" />
        </div>

        <div className="post-signup-welcome-pulse relative z-10 mx-auto mt-5 flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/15 text-primary">
          <ShieldCheck className="h-7 w-7" aria-hidden="true" />
        </div>

        <p className="relative z-10 mt-6 text-[11px] font-black uppercase tracking-[0.28em] text-primary">
          Solicitação registrada
        </p>
        <h2 className="relative z-10 mt-3 text-3xl font-black tracking-tight text-foreground">
          Bem-vindo ao SIED
        </h2>
        <p className="relative z-10 mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          {message}
        </p>
        <p className="relative z-10 mx-auto mt-2 max-w-md text-xs leading-5 text-muted-foreground/80">
          Aguarde a liberação institucional pelo órgão competente antes de acessar os módulos do
          sistema.
        </p>

        <p className="relative z-10 mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/80">
          Retornando ao login em instantes...
        </p>
      </section>
    </div>
  );
}

function LoginSplash() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    if (sessionStorage.getItem(LOGIN_SPLASH_KEY)) return false;

    sessionStorage.setItem(LOGIN_SPLASH_KEY, "1");

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    return true;
  });

  useEffect(() => {
    if (!visible) return;
    const timeoutId = window.setTimeout(() => setVisible(false), LOGIN_SPLASH_DURATION_MS);
    return () => window.clearTimeout(timeoutId);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="login-splash pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-background/75 backdrop-blur-2xl"
      aria-hidden="true"
    >
      <style>{`
        .login-splash {
          animation: loginSplashBackdrop ${LOGIN_SPLASH_DURATION_MS}ms ease forwards;
        }

        .login-splash-badge {
          animation: loginSplashBadge ${LOGIN_SPLASH_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
          will-change: transform, opacity;
        }

        .login-splash-glow {
          background: radial-gradient(
            circle,
            color-mix(in oklab, var(--primary) 55%, transparent) 0%,
            transparent 70%
          );
          animation: loginSplashGlow ${LOGIN_SPLASH_DURATION_MS}ms ease forwards;
        }

        .login-splash-ring {
          border-radius: 9999px;
          will-change: transform, opacity;
        }

        .login-splash-ring-1 {
          inset: -16%;
          border: 2px solid rgba(250, 204, 21, 0.75);
          box-shadow: 0 0 18px rgba(250, 204, 21, 0.35);
          animation: loginSplashRing1 ${LOGIN_SPLASH_DURATION_MS}ms ease forwards;
        }

        .login-splash-ring-2 {
          inset: -32%;
          border: 1.5px solid rgba(234, 179, 8, 0.55);
          animation: loginSplashRing2 ${LOGIN_SPLASH_DURATION_MS}ms ease forwards;
        }

        @keyframes loginSplashRing1 {
          0% {
            opacity: 0;
            transform: rotate(0deg) scale(0.7);
          }
          25% {
            opacity: 1;
          }
          70% {
            opacity: 0.75;
          }
          100% {
            opacity: 0;
            transform: rotate(130deg) scale(1.18);
          }
        }

        @keyframes loginSplashRing2 {
          0% {
            opacity: 0;
            transform: rotate(0deg) scale(0.75);
          }
          25% {
            opacity: 0.8;
          }
          70% {
            opacity: 0.5;
          }
          100% {
            opacity: 0;
            transform: rotate(-110deg) scale(1.22);
          }
        }

        @keyframes loginSplashBadge {
          0% {
            transform: scale(0.55);
            opacity: 0;
          }
          22% {
            transform: scale(1.06);
            opacity: 1;
          }
          34% {
            transform: scale(1);
            opacity: 1;
          }
          70% {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
          100% {
            transform: scale(0.22) translateY(-32vh);
            opacity: 0;
          }
        }

        @keyframes loginSplashGlow {
          0% {
            opacity: 0;
          }
          30% {
            opacity: 0.9;
          }
          70% {
            opacity: 0.55;
          }
          100% {
            opacity: 0;
          }
        }

        @keyframes loginSplashBackdrop {
          0%, 68% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .login-splash,
          .login-splash-badge,
          .login-splash-glow,
          .login-splash-ring-1,
          .login-splash-ring-2 {
            animation: none;
          }
        }
      `}</style>

      <div className="login-splash-badge relative">
        <span className="login-splash-glow pointer-events-none absolute inset-0 rounded-full blur-3xl" />
        <span className="login-splash-ring login-splash-ring-1 pointer-events-none absolute" />
        <span className="login-splash-ring login-splash-ring-2 pointer-events-none absolute" />
        <img
          src="/sied-mark.svg?v=2"
          alt="Polícia Civil"
          className="relative h-60 w-60 object-contain drop-shadow-[0_0_50px_rgba(34,197,94,0.5)] sm:h-80 sm:w-80"
        />
      </div>
    </div>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [postSignupMessage, setPostSignupMessage] = useState<string | null>(null);
  const [showSignupWelcome, setShowSignupWelcome] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const postSignup = readPostSignupLogin();
    if (!postSignup) return;
    setUsuario(postSignup.login);
    setPostSignupMessage(postSignup.message);
    setShowSignupWelcome(true);
  }, []);

  useEffect(() => {
    if (!showSignupWelcome) return;
    const timeoutId = window.setTimeout(() => setShowSignupWelcome(false), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [showSignupWelcome]);

  useEffect(() => {
    void (async () => {
      try {
        const session = await getSession();
        if (!session) return;
        const profile = await getCurrentProfileWithRetry();
        if (!profile) return;

        if (profile.status_autorizacao === "bloqueado") {
          await logout();
          return;
        }

        registerAccessContextInBackground();

        if (!isAuthorized(profile)) {
          navigate({ to: "/aguardando-autorizacao", replace: true });
          return;
        }

        navigate({ to: getPostAuthDestination(), replace: true });
      } catch (error) {
        console.error("[LoginPage] Falha ao validar sessão existente", error);
      }
    })();
  }, [navigate]);

  useEffect(() => {
    const erroCode = new URLSearchParams(window.location.search).get("erro");
    if (erroCode === "profile_load_failed" || erroCode === "profile_missing") {
      setErro(
        "Login autenticado, mas o perfil não carregou nesta tentativa. Tente entrar novamente; se persistir, verifique o vínculo do usuário em profiles.",
      );
      clearLoginErrorQueryParam();
    } else if (erroCode === "access_blocked") {
      setErro("Seu acesso está bloqueado. Procure um administrador do sistema.");
      clearLoginErrorQueryParam();
    }
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    clearLoginErrorQueryParam();
    setErro(null);
    setLoading(true);

    try {
      const loginOrEmail = usuario.trim();
      await authenticateWithLoginOrEmail(loginOrEmail, senha);

      const profile = await getCurrentProfileWithRetry();
      if (!profile) {
        throw new AuthFlowError("PROFILE_FETCH_FAILED", "Perfil não encontrado após autenticação.");
      }

      if (profile.status_autorizacao === "bloqueado") {
        await logout();
        setErro("Seu acesso está bloqueado. Procure um administrador do sistema.");
        return;
      }

      await registerAccessContextInBackground();

      if (!isAuthorized(profile)) {
        navigate({ to: "/aguardando-autorizacao" });
        return;
      }

      navigate({ to: getPostAuthDestination() });
    } catch (err) {
      console.error("[LoginPage] Falha no fluxo de login", err);
      setErro(getFriendlyLoginError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sied-login-shell relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-4 py-10">
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .post-signup-welcome,
          .post-signup-welcome-card,
          .post-signup-panel-sheen,
          .post-signup-loading-bar,
          .post-signup-welcome-pulse {
            animation: none !important;
          }
        }

        .post-signup-welcome-card {
          animation: postSignupWelcomeCard 520ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        .post-signup-welcome-pulse {
          animation: postSignupWelcomePulse 1.8s ease-in-out infinite;
        }

        .post-signup-panel-sheen {
          animation: postSignupPanelSheen 3.2s ease-in-out infinite;
          mix-blend-mode: screen;
        }

        .post-signup-loading-bar {
          animation: postSignupLoadingBar 1.65s ease-in-out infinite;
        }

        @keyframes postSignupWelcomeCard {
          0% {
            opacity: 0;
            transform: translateY(18px) scale(0.96);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes postSignupWelcomePulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.24);
          }
          50% {
            box-shadow: 0 0 0 18px rgba(34, 197, 94, 0);
          }
        }

        @keyframes postSignupPanelSheen {
          0%, 28% {
            transform: translateX(-130%) rotate(12deg);
            opacity: 0;
          }
          38% {
            opacity: 0.6;
          }
          58% {
            transform: translateX(620%) rotate(12deg);
            opacity: 0;
          }
          100% {
            transform: translateX(620%) rotate(12deg);
            opacity: 0;
          }
        }

        @keyframes postSignupLoadingBar {
          0% {
            transform: translateX(-130%);
            opacity: 0.24;
          }
          45% {
            opacity: 1;
          }
          100% {
            transform: translateX(330%);
            opacity: 0.24;
          }
        }
      `}</style>

      {showSignupWelcome ? (
        <PostSignupWelcomeOverlay message={postSignupMessage ?? POST_SIGNUP_MESSAGE} />
      ) : (
        <LoginSplash />
      )}

      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-success/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-4 flex items-center justify-center gap-2 text-[10px] tracking-[0.25em] font-bold text-destructive">
          <span className="h-px w-8 bg-destructive/50" />
          ACESSO RESTRITO
          <span className="h-px w-8 bg-destructive/50" />
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-2xl shadow-black/40">
          <div className="px-8 pt-8 pb-6 text-center border-b border-border bg-gradient-to-b from-primary/5 to-transparent">
            <div className="relative isolate mx-auto -mt-3 mb-4 flex h-[104px] w-[118px] items-center justify-center overflow-visible">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -inset-4 z-0 rounded-[2rem] bg-primary/16 blur-2xl"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-2 z-0 rounded-[1.35rem] border border-primary/20 bg-primary/5"
              />
              <img
                src="/sied-mark.svg?v=2"
                alt="Logo SIED"
                className="relative z-10 mx-auto h-[134px] w-auto object-contain drop-shadow-[0_12px_18px_rgba(2,12,27,0.72)]"
                style={{ transform: "translateY(1px)" }}
              />
            </div>
            <h1 className="text-2xl font-bold tracking-wide text-foreground">SIED</h1>
            <p className="text-xs text-muted-foreground mt-1">Sistema Integrado de Evidências e Dados</p>
            <p className="text-[10px] text-muted-foreground/80 mt-1 tracking-wider uppercase">
              DT Itabela · 23ª COORPIN
            </p>
          </div>

          <form onSubmit={handleSubmit} className="px-8 py-7 space-y-5">
            <div className="space-y-2">
              <Label
                htmlFor="usuario"
                className="text-xs tracking-wider uppercase text-muted-foreground font-semibold"
              >
                E-mail ou login
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="usuario"
                  autoComplete="username"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  placeholder="Digite seu e-mail ou login"
                  className="pl-9 h-11 bg-background/60 border-border focus-visible:ring-primary"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label
                  htmlFor="senha"
                  className="text-xs tracking-wider uppercase text-muted-foreground font-semibold"
                >
                  Senha
                </Label>
                <a
                  href={PASSWORD_RECOVERY_WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-medium text-primary underline-offset-2 hover:underline"
                >
                  Recuperar senha
                </a>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="senha"
                  type={showSenha ? "text" : "password"}
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Digite sua senha"
                  className="pl-9 pr-10 h-11 bg-background/60 border-border focus-visible:ring-primary"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowSenha((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
                  aria-label={showSenha ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {postSignupMessage && (
              <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5 text-xs text-primary">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{postSignupMessage}</span>
              </div>
            )}

            {erro && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{erro}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-bold tracking-[0.15em] uppercase text-xs"
            >
              {loading ? (
                "Verificando…"
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" /> Entrar
                </>
              )}
            </Button>

            <p className="text-center text-[10px] text-muted-foreground leading-relaxed">
              Uso exclusivo de servidores autorizados.
              <br />
              Acessos são monitorados e registrados em auditoria.
            </p>

            <p className="text-xs text-center">
              Não tem conta?{" "}
              <Link to="/criar-conta" className="underline">
                Criar conta
              </Link>
            </p>
          </form>

          <div className="px-8 py-3 border-t border-border bg-muted/20 text-center text-[10px] text-muted-foreground tracking-wider">
            © 2026 Polícia Civil — Uso restrito a agentes autorizados
          </div>
        </div>
      </div>
    </div>
  );
}
