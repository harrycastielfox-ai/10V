import { Clock3, Send } from "lucide-react";
import { REMESSA_FINAL_STATUS_OPTIONS, type RemessaFinalStatus } from "@/lib/remessaFinal";

type RemessaFinalControlProps = {
  value: RemessaFinalStatus;
  dataRemessa?: string | null;
  onChange: (value: RemessaFinalStatus) => void;
};

function formatDate(value: string | null | undefined) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/u.exec(value ?? "");
  return match ? `${match[3]}/${match[2]}/${match[1]}` : null;
}

export function RemessaFinalControl({ value, dataRemessa, onChange }: RemessaFinalControlProps) {
  const formattedDate = formatDate(dataRemessa);

  return (
    <fieldset className="md:col-span-2 lg:col-span-3">
      <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Remessa final
      </legend>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="inline-grid h-11 grid-cols-2 rounded-lg border border-border bg-background p-1 sm:w-[22rem]">
          {REMESSA_FINAL_STATUS_OPTIONS.map((option) => {
            const selected = value === option.value;
            const Icon = option.value === "remetido" ? Send : Clock3;

            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange(option.value)}
                className={`inline-flex min-w-0 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition ${
                  selected
                    ? option.value === "remetido"
                      ? "bg-success text-success-foreground shadow-sm"
                      : "bg-info text-white shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          {value === "remetido"
            ? formattedDate
              ? `Data da remessa: ${formattedDate}`
              : "A data será registrada ao salvar."
            : "Sem remessa final registrada."}
        </p>
      </div>
    </fieldset>
  );
}
