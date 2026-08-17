import * as Dialog from "@radix-ui/react-dialog";
import { Crosshair, Pencil, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  createEmptySeizedWeapon,
  parseSeizedWeapons,
  serializeSeizedWeapons,
  type SeizedWeapon,
} from "@/lib/seizedWeapons";

type SeizedWeaponsFieldProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  value: string;
  onValueChange: (value: string) => void;
};

function createWeaponId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `arma-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function SeizedWeaponsField({
  checked,
  onCheckedChange,
  value,
  onValueChange,
}: SeizedWeaponsFieldProps) {
  const weapons = useMemo(() => parseSeizedWeapons(value), [value]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SeizedWeapon>(createEmptySeizedWeapon);
  const [error, setError] = useState("");

  const openNewWeapon = () => {
    setDraft(createEmptySeizedWeapon());
    setError("");
    setOpen(true);
  };

  const openWeapon = (weapon: SeizedWeapon) => {
    setDraft(weapon);
    setError("");
    setOpen(true);
  };

  const handleCheckedChange = (nextChecked: boolean) => {
    onCheckedChange(nextChecked);
    if (!nextChecked) {
      onValueChange("");
      setOpen(false);
      return;
    }
    if (!weapons.length) openNewWeapon();
  };

  const saveWeapon = () => {
    const nome = draft.nome.trim();
    if (!nome) {
      setError("Informe o nome ou o tipo da arma.");
      return;
    }

    const savedWeapon: SeizedWeapon = {
      ...draft,
      id: draft.id || createWeaponId(),
      nome,
      marcaModelo: draft.marcaModelo.trim(),
      calibre: draft.calibre.trim(),
      numeroSerie: draft.numeroSerie.trim(),
      observacoes: draft.observacoes.trim(),
    };
    const nextWeapons = draft.id
      ? weapons.map((weapon) => (weapon.id === draft.id ? savedWeapon : weapon))
      : [...weapons, savedWeapon];
    onValueChange(serializeSeizedWeapons(nextWeapons));
    setOpen(false);
  };

  const deleteWeapon = () => {
    if (!draft.id) return;
    onValueChange(serializeSeizedWeapons(weapons.filter((weapon) => weapon.id !== draft.id)));
    setOpen(false);
  };

  const updateDraft = (field: keyof SeizedWeapon, nextValue: string) => {
    setDraft((current) => ({ ...current, [field]: nextValue }));
    if (field === "nome" && nextValue.trim()) setError("");
  };

  return (
    <div className="md:col-span-2 lg:col-span-3">
      <div className="sipi-shimmer flex min-h-14 flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition focus-within:border-primary/50">
        <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => handleCheckedChange(event.target.checked)}
            className="size-4 accent-primary"
          />
          <span>Houve apreensão de arma de fogo?</span>
        </label>

        {checked ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 border-border md:border-l md:pl-3">
            {weapons.length ? (
              weapons.map((weapon) => (
                <button
                  key={weapon.id}
                  type="button"
                  onClick={() => openWeapon(weapon)}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-background/65 px-3 py-2 text-left text-sm font-semibold transition hover:border-primary/45 hover:text-primary"
                  title={`Editar ${weapon.nome}`}
                >
                  <Crosshair className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{weapon.nome}</span>
                  <Pencil className="h-3 w-3 shrink-0 opacity-55" />
                </button>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">Nenhuma arma vinculada</span>
            )}
            <button
              type="button"
              onClick={openNewWeapon}
              aria-label="Adicionar outra arma"
              title="Adicionar outra arma"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/45 bg-emerald-500/12 text-emerald-400 transition hover:bg-emerald-500/20 hover:text-emerald-300"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[91] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-5 shadow-2xl outline-none sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">
                  Arma apreendida
                </p>
                <Dialog.Title className="mt-1 text-xl font-black text-foreground">
                  {draft.id ? "Editar arma vinculada" : "Adicionar arma"}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                  Registre somente as informações disponíveis no momento.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Fechar"
                  className="inline-flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:bg-accent hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <WeaponInput
                label="Nome / tipo da arma *"
                placeholder="Ex.: Revólver"
                value={draft.nome}
                onChange={(nextValue) => updateDraft("nome", nextValue)}
                autoFocus
              />
              <WeaponInput
                label="Marca / modelo"
                placeholder="Ex.: Taurus 82"
                value={draft.marcaModelo}
                onChange={(nextValue) => updateDraft("marcaModelo", nextValue)}
              />
              <WeaponInput
                label="Calibre"
                placeholder="Ex.: .38 ou 9 mm"
                value={draft.calibre}
                onChange={(nextValue) => updateDraft("calibre", nextValue)}
              />
              <WeaponInput
                label="Número de série"
                placeholder="Informe se estiver legível"
                value={draft.numeroSerie}
                onChange={(nextValue) => updateDraft("numeroSerie", nextValue)}
              />
              <label className="sm:col-span-2">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Características / observações
                </span>
                <textarea
                  rows={3}
                  value={draft.observacoes}
                  onChange={(event) => updateDraft("observacoes", event.target.value)}
                  placeholder="Ex.: cabo de madeira, estado de conservação ou sinais identificadores"
                  className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary"
                />
              </label>
            </div>

            {error ? <p className="mt-3 text-sm font-medium text-destructive">{error}</p> : null}

            <div className="mt-6 flex items-center justify-between gap-3">
              <div>
                {draft.id ? (
                  <button
                    type="button"
                    onClick={deleteWeapon}
                    className="inline-flex size-10 items-center justify-center rounded-lg border border-destructive/35 bg-destructive/10 text-destructive transition hover:bg-destructive/20"
                    aria-label="Excluir arma"
                    title="Excluir arma"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold transition hover:bg-accent"
                  >
                    Cancelar
                  </button>
                </Dialog.Close>
                <button
                  type="button"
                  onClick={saveWeapon}
                  className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-emerald-950 transition hover:bg-emerald-400"
                >
                  {draft.id ? "Salvar alterações" : "Adicionar arma"}
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function WeaponInput({
  label,
  value,
  placeholder,
  onChange,
  autoFocus = false,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary"
      />
    </label>
  );
}
