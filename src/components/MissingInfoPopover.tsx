import { useEffect, useRef, useState } from "react";
import { Info, X } from "lucide-react";

type MissingInfoItem = {
  label: string;
  blocking?: boolean;
};

type MissingInfoPopoverProps = {
  items: MissingInfoItem[];
};

export function MissingInfoPopover({ items }: MissingInfoPopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hasBlocking = items.some((item) => item.blocking);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={containerRef} className="sipi-print-hidden relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] transition hover:-translate-y-0.5 hover:shadow-lg ${
          hasBlocking
            ? "border-red-500/45 bg-red-500/10 text-red-300 hover:shadow-red-500/10"
            : "sipi-missing-info-warning border-warning/55 bg-warning/10 text-warning hover:shadow-warning/15"
        }`}
        aria-expanded={open}
      >
        Ainda faltam {items.length} informaç{items.length === 1 ? "ão" : "ões"}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Informações pendentes"
          className="absolute left-0 top-[calc(100%+0.65rem)] z-40 w-[min(88vw,360px)] overflow-hidden rounded-xl border border-border/80 bg-card/98 text-left shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl"
        >
          <div className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                Informações pendentes
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Confira o que ainda falta neste cadastro.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              className="rounded-md border border-border/70 p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="max-h-72 space-y-2 overflow-auto px-4 py-3">
            {items.map((item) => (
              <div
                key={item.label}
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                  item.blocking
                    ? "border-red-500/30 bg-red-500/8 text-red-100"
                    : "sipi-missing-info-warning border-warning/35 bg-warning/8 text-warning"
                }`}
              >
                <Info
                  className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                    item.blocking ? "text-red-300" : "sipi-missing-info-warning-icon text-warning"
                  }`}
                />
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-border/70 bg-background/45 px-4 py-3 text-xs text-muted-foreground">
            Clique em <span className="font-semibold text-primary">Editar</span> para adicionar as
            informações.
          </div>
        </div>
      ) : null}
    </div>
  );
}
