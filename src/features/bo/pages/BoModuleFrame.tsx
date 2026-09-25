import { Outlet } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useAppProfile } from "@/components/AppProfileContext";
import { canViewBos } from "@/lib/authz";
import "../bo.css";

export default function BoModuleFrame() {
  return (
    <AppLayout module="bo">
      <BoModuleContent />
    </AppLayout>
  );
}

function BoModuleContent() {
  const profile = useAppProfile();
  if (!canViewBos(profile)) {
    return (
      <section className="mx-auto mt-10 max-w-xl rounded-2xl border border-warning/30 bg-card p-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10 text-warning">
          <ShieldAlert className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-xl font-black">Acesso restrito</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Seu perfil não possui autorização para consultar boletins de ocorrência.
        </p>
      </section>
    );
  }
  return (
    <div className="bo-module-shell -m-4 min-h-screen px-4 pb-10 pt-4 md:-m-6 md:px-6 md:pt-5 lg:-m-8 lg:px-6 lg:pt-6">
      <Outlet />
    </div>
  );
}
