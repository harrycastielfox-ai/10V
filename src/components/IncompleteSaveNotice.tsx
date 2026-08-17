import { AlertTriangle, LoaderCircle } from "lucide-react";

// Usado quando o registro principal já foi gravado mas uma etapa complementar
// falhou (fotografias, tags, pessoas). O usuário fica na tela até resolver, em
// vez de receber um aviso que some na navegação — e não precisa salvar de novo.
export function IncompleteSaveNotice({
  title,
  description,
  busy = false,
  retryLabel = "Tentar novamente",
  continueLabel = "Continuar assim mesmo",
  onRetry,
  onContinue,
}: {
  title: string;
  description: string;
  busy?: boolean;
  retryLabel?: string;
  continueLabel?: string;
  onRetry: () => void;
  onContinue: () => void;
}) {
  return (
    <section className="rounded-xl border border-warning/35 bg-warning/10 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-warning">{title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onContinue}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-xs font-semibold hover:border-warning/45 disabled:opacity-50"
            >
              {continueLabel}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onRetry}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-warning px-4 text-xs font-bold text-background disabled:opacity-50"
            >
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {retryLabel}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
