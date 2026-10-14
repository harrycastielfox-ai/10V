import { Activity, Plus, Filter, RefreshCw, ChevronDown } from "lucide-react";

interface Props {
  title: string;
  subtitle: string;
  showActions?: boolean;
  accentClassName?: string;
}

export function PageHeader({ title, subtitle, showActions = true, accentClassName }: Props) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-start gap-4 mb-6">
      <div className="flex items-start gap-3 flex-1">
        <Activity className={`mt-1 h-7 w-7 ${accentClassName ?? "text-primary"}`} />
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>
      </div>
      {showActions && (
        <div className="flex items-center gap-2 flex-wrap">
          <button className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition shadow-lg shadow-primary/20">
            <Plus className="h-4 w-4" /> Novo Inquérito
          </button>
          <button className="inline-flex items-center gap-2 border border-border bg-card px-4 py-2.5 rounded-lg text-sm hover:bg-accent transition">
            <Filter className="h-4 w-4" /> Filtros Rápidos <ChevronDown className="h-3 w-3" />
          </button>
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground px-3 py-2.5">
            <RefreshCw className="h-3.5 w-3.5" /> Atualizado: 24/04/2026, 09:07
          </div>
        </div>
      )}
    </div>
  );
}
