import type { ReactNode } from "react";
import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { getCurrentProfile, getSession, logout } from "@/lib/auth";
import { isAuthorized, type UserProfile } from "@/lib/authz";
import { getMobileRouteRedirect, MOBILE_VIEWPORT_QUERY } from "@/lib/mobileExperience";
import { AppProfileContext } from "./AppProfileContext";
import { MobileNavigation } from "./MobileNavigation";

type AppModule = "inqueritos" | "veiculos" | "vistorias" | "objetos" | "bo";

const AppSidebar = lazy(() =>
  import("./AppSidebar").then((module) => ({ default: module.AppSidebar })),
);
const CommandPalette = lazy(() =>
  import("./CommandPalette").then((module) => ({ default: module.CommandPalette })),
);
const DueSoonNotification = lazy(() =>
  import("./DueSoonNotification").then((module) => ({ default: module.DueSoonNotification })),
);
const VehiclesSidebar = lazy(() =>
  import("./VehiclesSidebar").then((module) => ({ default: module.VehiclesSidebar })),
);
const VehiclesMobileNavigation = lazy(() =>
  import("./VehiclesMobileNavigation").then((module) => ({
    default: module.VehiclesMobileNavigation,
  })),
);
const VistoriasSidebar = lazy(() =>
  import("./VistoriasSidebar").then((module) => ({ default: module.VistoriasSidebar })),
);
const ObjectsSidebar = lazy(() =>
  import("./ObjectsSidebar").then((module) => ({ default: module.ObjectsSidebar })),
);
const ObjectsMobileNavigation = lazy(() =>
  import("./ObjectsMobileNavigation").then((module) => ({
    default: module.ObjectsMobileNavigation,
  })),
);
const BoSidebar = lazy(() =>
  import("./BoSidebar").then((module) => ({ default: module.BoSidebar })),
);
const BoMobileNavigation = lazy(() =>
  import("./BoMobileNavigation").then((module) => ({ default: module.BoMobileNavigation })),
);

function useMobileViewport() {
  const [mobile, setMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_VIEWPORT_QUERY);
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return mobile;
}

export function AppLayout({
  children,
  module = "inqueritos",
  hideNavigation = false,
}: {
  children: ReactNode;
  module?: AppModule;
  hideNavigation?: boolean;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const mobile = useMobileViewport();
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
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
        if (!isAuthorized(profile)) {
          if (!cancelled) navigate({ to: "/aguardando-autorizacao", replace: true });
          return;
        }
        if (!cancelled) {
          setProfile(profile);
          setReady(true);
        }
      } catch (error) {
        console.error("[AppLayout] Falha ao carregar profile", error);
        if (!cancelled) {
          navigate({
            to: "/login",
            search: { erro: "profile_load_failed" } as never,
            replace: true,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    const onProfileAvatarUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ avatarPath?: string }>;
      const avatarPath = customEvent.detail?.avatarPath;
      if (!avatarPath) return;

      setProfile((current) => (current ? { ...current, avatar_path: avatarPath } : current));
    };

    window.addEventListener("profile-avatar-updated", onProfileAvatarUpdated as EventListener);
    return () => {
      window.removeEventListener("profile-avatar-updated", onProfileAvatarUpdated as EventListener);
    };
  }, []);

  const mobileRedirect = mobile === null ? null : getMobileRouteRedirect(pathname, mobile);

  useEffect(() => {
    if (!ready || !mobileRedirect) return;
    navigate({ to: mobileRedirect, replace: true });
  }, [mobileRedirect, navigate, ready]);

  if (!ready || !profile || mobile === null || mobileRedirect) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        <p className="text-sm">Carregando sessão...</p>
      </div>
    );
  }

  return (
    <AppProfileContext.Provider value={profile}>
      <div
        className={`app-layout app-layout-${module} min-h-screen flex w-full bg-background text-foreground`}
        data-app-module={module}
      >
        {hideNavigation ? null : (
          <Suspense fallback={null}>
            {mobile ? (
              module === "veiculos" ? (
                <VehiclesMobileNavigation profile={profile} />
              ) : module === "objetos" ? (
                <ObjectsMobileNavigation profile={profile} />
              ) : module === "bo" ? (
                <BoMobileNavigation profile={profile} />
              ) : module === "vistorias" ? (
                <VehiclesMobileNavigation profile={profile} module="vistorias" />
              ) : (
                <MobileNavigation profile={profile} />
              )
            ) : module === "veiculos" ? (
              <VehiclesSidebar profile={profile} />
            ) : module === "objetos" ? (
              <ObjectsSidebar profile={profile} />
            ) : module === "bo" ? (
              <BoSidebar profile={profile} />
            ) : module === "vistorias" ? (
              <VistoriasSidebar profile={profile} />
            ) : (
              <>
                <AppSidebar profile={profile} />
                <DueSoonNotification />
              </>
            )}
          </Suspense>
        )}
        <main
          className={`flex-1 min-w-0 overflow-x-hidden ${
            mobile ? (hideNavigation ? "px-4 py-5" : "px-4 pb-24 pt-20") : "p-6 lg:p-8"
          }`}
        >
          {children}
        </main>
        {/* Busca global por Ctrl+K. Fica fora do <main> para valer em todos os módulos. */}
        {mobile || hideNavigation ? null : (
          <Suspense fallback={null}>
            <CommandPalette />
          </Suspense>
        )}
      </div>
    </AppProfileContext.Provider>
  );
}
