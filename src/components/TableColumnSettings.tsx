/* eslint-disable react-refresh/only-export-components */
import { ChevronDown, ChevronUp, Columns3, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  getTablePreferences,
  saveTablePreferences,
} from "@/lib/repositories/tablePreferencesRepository";

export type TableColumnDefinition = {
  id: string;
  label: string;
  defaultWidth: number;
  defaultVisible?: boolean;
  required?: boolean;
  hiddenFromSettings?: boolean;
  align?: "left" | "center" | "right";
};

export type ColumnPreference = {
  id: string;
  visible: boolean;
  width: number;
  order: number;
};

function defaultPreferences(columns: readonly TableColumnDefinition[]) {
  return columns.map((column, order) => ({
    id: column.id,
    visible: column.required ? true : (column.defaultVisible ?? true),
    width: column.defaultWidth,
    order,
  }));
}

function normalizePreferences(
  input: Partial<ColumnPreference>[],
  definitions: readonly TableColumnDefinition[],
) {
  const definitionMap = new Map(definitions.map((definition) => [definition.id, definition]));
  const valid = input
    .map((item, index) => ({
      ...item,
      derivedOrder: Number.isFinite(item.order) ? item.order! : index,
    }))
    .filter((item): item is typeof item & { id: string } =>
      Boolean(item.id && definitionMap.has(item.id)),
    )
    .sort((left, right) => left.derivedOrder - right.derivedOrder);
  const saved = new Map(valid.map((item) => [item.id, item]));
  const orderedIds = [
    ...valid.map((item) => item.id),
    ...definitions.map((definition) => definition.id).filter((id) => !saved.has(id)),
  ];

  return orderedIds.map((id, order) => {
    const definition = definitionMap.get(id)!;
    const stored = saved.get(id);
    return {
      id,
      visible: definition.required ? true : (stored?.visible ?? definition.defaultVisible ?? true),
      width: Math.max(72, Number(stored?.width) || definition.defaultWidth),
      order,
    };
  });
}

function readLocalPreferences(storageKey: string, definitions: readonly TableColumnDefinition[]) {
  if (typeof window === "undefined") return defaultPreferences(definitions);
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(storageKey) ?? "[]",
    ) as Partial<ColumnPreference>[];
    return Array.isArray(parsed) && parsed.length > 0
      ? normalizePreferences(parsed, definitions)
      : defaultPreferences(definitions);
  } catch {
    return defaultPreferences(definitions);
  }
}

export function useTableColumnPreferences(
  storageKey: string,
  definitions: readonly TableColumnDefinition[],
  remoteScope?: string,
) {
  const [preferences, setPreferences] = useState<ColumnPreference[]>(() =>
    readLocalPreferences(storageKey, definitions),
  );
  const [remoteReady, setRemoteReady] = useState(!remoteScope);

  useEffect(() => {
    setPreferences(readLocalPreferences(storageKey, definitions));
  }, [definitions, storageKey]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(preferences));
  }, [preferences, storageKey]);

  useEffect(() => {
    if (!remoteScope) return;
    let active = true;
    setRemoteReady(false);
    void (async () => {
      try {
        const remote = await getTablePreferences(remoteScope);
        if (!active) return;
        if (remote?.length) {
          setPreferences(normalizePreferences(remote, definitions));
        } else {
          await saveTablePreferences(remoteScope, readLocalPreferences(storageKey, definitions));
        }
      } catch (error) {
        if (import.meta.env.DEV) console.warn("Falha ao carregar preferências remotas", error);
      } finally {
        if (active) setRemoteReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [definitions, remoteScope, storageKey]);

  useEffect(() => {
    if (!remoteScope || !remoteReady) return;
    const timer = window.setTimeout(() => {
      void saveTablePreferences(remoteScope, preferences).catch((error) => {
        if (import.meta.env.DEV) console.warn("Falha ao salvar preferências remotas", error);
      });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [preferences, remoteReady, remoteScope]);

  const definitionMap = useMemo(
    () => new Map(definitions.map((definition) => [definition.id, definition])),
    [definitions],
  );
  const visibleColumns = preferences
    .filter((preference) => preference.visible)
    .map((preference) => ({ ...definitionMap.get(preference.id)!, ...preference }))
    .filter((column) => Boolean(column.label));

  return {
    preferences,
    visibleColumns,
    toggle(id: string) {
      setPreferences((current) =>
        current.map((item) =>
          item.id === id && !definitionMap.get(id)?.required
            ? { ...item, visible: !item.visible }
            : item,
        ),
      );
    },
    resize(id: string, width: number) {
      setPreferences((current) =>
        current.map((item) => (item.id === id ? { ...item, width: Math.max(72, width) } : item)),
      );
    },
    move(id: string, direction: -1 | 1) {
      setPreferences((current) => {
        const index = current.findIndex((item) => item.id === id);
        const nextIndex = index + direction;
        if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
        const next = [...current];
        [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
        return next.map((item, order) => ({ ...item, order }));
      });
    },
    apply(next: Partial<ColumnPreference>[]) {
      setPreferences(normalizePreferences(next, definitions));
    },
    reset() {
      setPreferences(defaultPreferences(definitions));
    },
    definitionMap,
  };
}

export function TableColumnSettings({
  definitions,
  controller,
}: {
  definitions: readonly TableColumnDefinition[];
  controller: ReturnType<typeof useTableColumnPreferences>;
}) {
  const [open, setOpen] = useState(false);
  const definitionMap = new Map(definitions.map((definition) => [definition.id, definition]));
  const editablePreferences = controller.preferences.filter(
    (preference) => !definitionMap.get(preference.id)?.hiddenFromSettings,
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-background/70 px-3 text-xs font-semibold transition hover:border-primary/40 hover:text-primary"
      >
        <Columns3 className="h-4 w-4" /> Colunas
      </button>
      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-[330px] rounded-xl border border-border bg-card p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-wider text-primary">
              Personalizar tabela
            </p>
            <button
              type="button"
              onClick={controller.reset}
              className="text-muted-foreground hover:text-foreground"
              title="Restaurar padrão"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[420px] space-y-1 overflow-y-auto">
            {editablePreferences.map((preference, index) => {
              const definition = definitionMap.get(preference.id);
              if (!definition) return null;
              return (
                <div
                  key={preference.id}
                  className="grid grid-cols-[1fr_76px_56px] items-center gap-2 rounded-lg border border-border/60 bg-background/50 p-2"
                >
                  <label className="flex min-w-0 items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={preference.visible}
                      disabled={definition.required}
                      onChange={() => controller.toggle(preference.id)}
                    />
                    <span className="truncate">{definition.label}</span>
                  </label>
                  <input
                    type="number"
                    min={72}
                    max={600}
                    step={8}
                    value={preference.width}
                    onChange={(event) =>
                      controller.resize(preference.id, Number(event.target.value))
                    }
                    aria-label={`Largura de ${definition.label}`}
                    className="h-8 rounded border border-border bg-card px-2 text-xs"
                  />
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => controller.move(preference.id, -1)}
                      className="rounded border border-border p-1 disabled:opacity-30"
                      title="Mover para a esquerda"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      disabled={index === editablePreferences.length - 1}
                      onClick={() => controller.move(preference.id, 1)}
                      className="rounded border border-border p-1 disabled:opacity-30"
                      title="Mover para a direita"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Visibilidade, ordem e largura ficam salvas no seu perfil.
          </p>
        </div>
      ) : null}
    </div>
  );
}
