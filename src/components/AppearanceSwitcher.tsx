import { Check, Lightbulb, Moon, PanelLeft, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import {
  APPEARANCE_STORAGE_KEY,
  applyAppearance,
  getStoredAppearance,
  type Appearance,
} from "@/lib/appearance";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const options: Array<{
  value: Appearance;
  label: string;
  description: string;
  icon: typeof Moon;
}> = [
  {
    value: "default",
    label: "Escuro",
    description: "Visual escuro original do SIED",
    icon: Moon,
  },
  {
    value: "light",
    label: "Claro",
    description: "Leitura confortável em ambientes claros",
    icon: Sun,
  },
  {
    value: "mixed",
    label: "Mesclar",
    description: "Conteúdo claro com lateral colorida",
    icon: PanelLeft,
  },
];

export function AppearanceSwitcher() {
  const [open, setOpen] = useState(false);
  const [appearance, setAppearance] = useState<Appearance>("default");

  useEffect(() => {
    const stored = getStoredAppearance();
    setAppearance(stored);
    applyAppearance(stored);

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== APPEARANCE_STORAGE_KEY) return;
      const nextAppearance = getStoredAppearance();
      setAppearance(nextAppearance);
      applyAppearance(nextAppearance);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  function selectAppearance(nextAppearance: Appearance) {
    setAppearance(nextAppearance);
    applyAppearance(nextAppearance);

    try {
      window.localStorage.setItem(APPEARANCE_STORAGE_KEY, nextAppearance);
    } catch {
      // The appearance still applies for the current session if storage is unavailable.
    }

    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider delayDuration={250}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="appearance-trigger"
                aria-label="Aparência"
                title="Aparência"
              >
                <Lightbulb className="h-[17px] w-[17px]" aria-hidden="true" />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">Aparência</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent align="end" sideOffset={10} className="w-64 p-2">
        <div className="px-2 pb-2 pt-1">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-foreground">Aparência</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Escolha o visual do sistema</p>
        </div>

        <div className="space-y-1" role="radiogroup" aria-label="Aparência do sistema">
          {options.map((option) => {
            const Icon = option.icon;
            const active = appearance === option.value;

            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => selectAppearance(option.value)}
                className={`flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active
                    ? "border-primary/55 bg-primary/12 text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${
                    active
                      ? "border-primary/45 bg-primary/15 text-primary"
                      : "border-border bg-card"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{option.label}</span>
                  <span className="block truncate text-[10px] opacity-80">
                    {option.description}
                  </span>
                </span>
                {active ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
