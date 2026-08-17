import { getBoStatusLabel, getBoStatusTone } from "../boTypes";

const toneClasses: Record<string, string> = {
  amber: "border-amber-400/30 bg-amber-500/15 text-amber-400",
  blue: "border-blue-400/30 bg-blue-500/15 text-blue-400",
  cyan: "border-cyan-400/30 bg-cyan-500/15 text-cyan-400",
  purple: "border-violet-400/30 bg-violet-500/15 text-violet-400",
  green: "border-emerald-400/30 bg-emerald-500/15 text-emerald-400",
  red: "border-red-400/30 bg-red-500/15 text-red-400",
  slate: "border-slate-400/25 bg-slate-500/15 text-slate-400",
};

export function BoStatusBadge({ status }: { status: string | null | undefined }) {
  const tone = getBoStatusTone(status);
  return (
    <span
      className={`inline-flex w-fit rounded-full border px-3 py-1 text-[10px] font-black ${toneClasses[tone]}`}
    >
      {getBoStatusLabel(status)}
    </span>
  );
}
