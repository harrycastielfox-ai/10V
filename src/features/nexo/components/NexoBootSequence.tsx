import { Fingerprint, ScanFace, ShieldCheck } from "lucide-react";

export function NexoBootSequence() {
  return (
    <div className="fixed inset-0 z-[120] overflow-hidden bg-[#07192b] text-white">
      <div className="nexo-boot-grid absolute inset-0 opacity-35" />
      <div className="nexo-boot-orbit nexo-boot-orbit-a" />
      <div className="nexo-boot-orbit nexo-boot-orbit-b" />
      <div className="absolute inset-0 flex items-center justify-center px-6">
        <div className="w-full max-w-[560px] text-center">
          <div className="relative mx-auto flex h-36 w-36 items-center justify-center">
            <span className="nexo-boot-ring absolute inset-0 rounded-full border border-[#4bd6e5]/30" />
            <span className="nexo-boot-ring nexo-boot-ring-delay absolute inset-4 rounded-full border border-[#70e5ee]/30" />
            <span className="absolute inset-8 rounded-full bg-[#0f3149] shadow-[0_0_50px_rgba(61,207,224,.2)]" />
            <Fingerprint className="nexo-boot-fingerprint relative h-14 w-14 text-[#7de7ee]" />
            <span className="nexo-boot-scanline absolute left-3 right-3 h-px bg-[#8cf4f5] shadow-[0_0_16px_#63e6ed]" />
          </div>
          <p className="mt-7 text-[10px] font-black uppercase tracking-[.42em] text-[#70d9e3]">
            SIED · Inteligência integrada
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-[-.04em] sm:text-5xl">NEXO</h1>
          <p className="mt-3 text-sm text-[#9db9c8]">
            Inicializando ambiente de análise relacional
          </p>
          <div className="mx-auto mt-8 grid max-w-[460px] grid-cols-3 gap-2 text-left">
            {[
              [ScanFace, "Identidades", "verificando"],
              [ShieldCheck, "Permissões", "validando"],
              [Fingerprint, "Vínculos", "indexando"],
            ].map(([Icon, label, state]) => (
              <div
                key={String(label)}
                className="rounded-xl border border-white/10 bg-white/[.04] p-3"
              >
                <Icon className="h-4 w-4 text-[#66d5e1]" />
                <strong className="mt-2 block text-[10px] uppercase tracking-wider">
                  {String(label)}
                </strong>
                <span className="mt-1 block text-[9px] text-[#7898aa]">{String(state)}</span>
              </div>
            ))}
          </div>
          <div className="mx-auto mt-7 h-1 max-w-[460px] overflow-hidden rounded-full bg-white/10">
            <span className="nexo-boot-progress block h-full rounded-full bg-gradient-to-r from-[#2387ac] via-[#68e0e9] to-white" />
          </div>
          <div className="mt-3 flex justify-between text-[9px] font-bold uppercase tracking-[.18em] text-[#64879a]">
            <span>Protocolo forense</span>
            <span>Ambiente seguro</span>
          </div>
        </div>
      </div>
    </div>
  );
}
