import { Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppProfileContext } from "@/components/AppProfileContext";
import { getCurrentProfile, getSession, logout } from "@/lib/auth";
import { canViewNexo, isAuthorized, type UserProfile } from "@/lib/authz";

export default function NexoModuleFrame() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [ready, setReady] = useState(false);

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
          if (!cancelled) navigate({ to: "/login", replace: true });
          return;
        }
        if (currentProfile.status_autorizacao === "bloqueado") {
          await logout();
          if (!cancelled) navigate({ to: "/login", replace: true });
          return;
        }
        if (!isAuthorized(currentProfile)) {
          if (!cancelled) navigate({ to: "/aguardando-autorizacao", replace: true });
          return;
        }
        if (!canViewNexo(currentProfile)) {
          if (!cancelled) navigate({ to: "/modulos", replace: true });
          return;
        }
        if (!cancelled) setProfile(currentProfile);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (!ready || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050a10] text-cyan-200/60">
        <div className="nexo-loader-ring" />
        <span className="ml-4 text-xs font-bold uppercase tracking-[0.2em]">
          Validando acesso NEXO
        </span>
      </div>
    );
  }

  return (
    <AppProfileContext.Provider value={profile}>
      <div className="nexo-shell min-h-screen w-full overflow-x-hidden bg-[#f4f7f9] text-[#203d53]">
        <Outlet />
      </div>
    </AppProfileContext.Provider>
  );
}
