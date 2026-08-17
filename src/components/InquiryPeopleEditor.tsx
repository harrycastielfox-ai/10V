import * as Dialog from "@radix-ui/react-dialog";
import { Pencil, Plus, Trash2, UserRound, X } from "lucide-react";
import { useState } from "react";
import {
  createInquiryPerson,
  INQUIRY_PERSON_ROLE_OPTIONS,
  type InquiryPersonFormValue,
  type InquiryPersonRole,
} from "@/lib/operationalContracts";

export type { InquiryPersonFormValue } from "@/lib/operationalContracts";

type InquiryPeopleEditorProps = {
  value: InquiryPersonFormValue[];
  onChange: (value: InquiryPersonFormValue[]) => void;
};

const ROLE_LABEL: Record<InquiryPersonRole, string> = {
  vitima: "Vítima",
  autor_investigado: "Autor / Investigado",
  testemunha: "Testemunha",
  outro: "Outro envolvido",
};

// O que cada papel significa, para quem preenche não precisar adivinhar.
const ROLE_HINT: Record<InquiryPersonRole, string> = {
  vitima: "Quem sofreu o fato.",
  autor_investigado: "Quem é apontado como autor. Abaixo, informe autoria e prisão.",
  testemunha: "Quem presenciou ou tem conhecimento do fato.",
  outro: "Comunicante, representante legal ou qualquer outro envolvido.",
};

const AUTORIA_OPTIONS = [
  { value: "true", label: "Determinada — o autor está identificado" },
  { value: "false", label: "Desconhecida — ainda não identificado" },
  { value: "", label: "Não informado" },
];

const PRISAO_OPTIONS = [
  { value: "true", label: "Preso" },
  { value: "false", label: "Solto" },
  { value: "", label: "Não informado" },
];

function toTriState(value: string): boolean | null {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function fromTriState(value: boolean | null): string {
  if (value === true) return "true";
  if (value === false) return "false";
  return "";
}

// Só entra no resumo o que foi de fato informado, para a linha não virar um
// amontoado de "não informado".
function personSummary(person: InquiryPersonFormValue): string[] {
  const parts: string[] = [];
  if (person.observacao.trim()) parts.push(person.observacao.trim());
  if (person.papel === "autor_investigado") {
    if (person.autoriaDeterminada === true) parts.push("Autoria determinada");
    if (person.autoriaDeterminada === false) parts.push("Autoria desconhecida");
    if (person.preso === true) parts.push("Preso");
    if (person.preso === false) parts.push("Solto");
  }
  return parts;
}

export function InquiryPeopleEditor({ value, onChange }: InquiryPeopleEditorProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<InquiryPersonFormValue>(createInquiryPerson);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const openNewPerson = () => {
    setDraft(createInquiryPerson());
    setEditingId(null);
    setError("");
    setOpen(true);
  };

  const openPerson = (person: InquiryPersonFormValue) => {
    setDraft(person);
    setEditingId(person.id);
    setError("");
    setOpen(true);
  };

  const savePerson = () => {
    const nome = draft.nome.trim();
    if (!nome) {
      setError("Informe o nome da pessoa.");
      return;
    }

    const isInvestigado = draft.papel === "autor_investigado";
    const savedPerson: InquiryPersonFormValue = {
      ...draft,
      nome,
      observacao: draft.observacao.trim(),
      autoriaDeterminada: isInvestigado ? draft.autoriaDeterminada : null,
      preso: isInvestigado ? draft.preso : null,
    };

    onChange(
      editingId
        ? value.map((person) => (person.id === editingId ? savedPerson : person))
        : [...value, savedPerson],
    );
    setOpen(false);
  };

  const deletePerson = () => {
    if (!editingId) return;
    onChange(value.filter((person) => person.id !== editingId));
    setOpen(false);
  };

  const updateDraft = (patch: Partial<InquiryPersonFormValue>) => {
    setDraft((current) => ({ ...current, ...patch }));
    if (patch.nome?.trim()) setError("");
  };

  return (
    <div className="space-y-3 md:col-span-2 lg:col-span-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-foreground">
            Vítimas, investigados e testemunhas
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            A autoria e a prisão do procedimento vêm do que for informado aqui.
          </p>
        </div>
        <button
          type="button"
          onClick={openNewPerson}
          className="inline-flex h-9 w-fit items-center gap-2 rounded-lg border border-primary/45 bg-primary/15 px-3 text-xs font-bold text-primary transition-colors hover:bg-primary/25"
        >
          <Plus className="size-4" aria-hidden="true" />
          Adicionar pessoa
        </button>
      </div>

      {value.length === 0 ? (
        <button
          type="button"
          onClick={openNewPerson}
          className="flex min-h-24 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background/40 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >
          <UserRound className="size-4" aria-hidden="true" />
          Adicionar a primeira pessoa envolvida
        </button>
      ) : (
        <ul className="space-y-2">
          {value.map((person) => {
            const summary = personSummary(person);
            return (
              <li key={person.id}>
                <button
                  type="button"
                  onClick={() => openPerson(person)}
                  title={`Editar ${person.nome || "pessoa"}`}
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition hover:border-primary/45"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-background/60 text-muted-foreground">
                    <UserRound className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                        {ROLE_LABEL[person.papel]}
                      </span>
                      <span className="truncate text-sm font-semibold">
                        {person.nome || "Sem nome"}
                      </span>
                    </span>
                    {summary.length > 0 && (
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {summary.join(" · ")}
                      </span>
                    )}
                  </span>
                  <Pencil className="size-3.5 shrink-0 opacity-55" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[91] max-h-[90vh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl outline-none sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                  Pessoa envolvida
                </p>
                <Dialog.Title className="mt-1 text-xl font-black text-foreground">
                  {editingId ? "Editar pessoa" : "Adicionar pessoa"}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                  Preencha só o que souber. O que ficar em branco não aparece no cadastro.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Fechar"
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:bg-accent hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Papel *
                </span>
                <select
                  value={draft.papel}
                  onChange={(event) =>
                    updateDraft({ papel: event.target.value as InquiryPersonRole })
                  }
                  className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:border-primary"
                >
                  {INQUIRY_PERSON_ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="mt-1.5 block text-xs text-muted-foreground">
                  {ROLE_HINT[draft.papel]}
                </span>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Nome *
                </span>
                <input
                  autoFocus
                  value={draft.nome}
                  onChange={(event) => updateDraft({ nome: event.target.value })}
                  placeholder={
                    draft.papel === "autor_investigado" ? "Nome ou Desconhecido" : "Nome completo"
                  }
                  className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:border-primary"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Apelido / observação
                </span>
                <input
                  value={draft.observacao}
                  onChange={(event) => updateDraft({ observacao: event.target.value })}
                  placeholder="Alcunha, condição ou vínculo"
                  className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:border-primary"
                />
              </label>

              {draft.papel === "autor_investigado" && (
                <div className="grid gap-4 rounded-xl border border-border/70 bg-background/45 p-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Autoria
                    </span>
                    <select
                      value={fromTriState(draft.autoriaDeterminada)}
                      onChange={(event) =>
                        updateDraft({ autoriaDeterminada: toTriState(event.target.value) })
                      }
                      className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:border-primary"
                    >
                      {AUTORIA_OPTIONS.map((option) => (
                        <option key={option.label} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Situação prisional
                    </span>
                    <select
                      value={fromTriState(draft.preso)}
                      onChange={(event) => updateDraft({ preso: toTriState(event.target.value) })}
                      className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:border-primary"
                    >
                      {PRISAO_OPTIONS.map((option) => (
                        <option key={option.label} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </div>

            {error ? <p className="mt-3 text-sm font-medium text-destructive">{error}</p> : null}

            <div className="mt-6 flex items-center justify-between gap-3">
              <div>
                {editingId ? (
                  <button
                    type="button"
                    onClick={deletePerson}
                    className="inline-flex size-10 items-center justify-center rounded-lg border border-destructive/35 bg-destructive/10 text-destructive transition hover:bg-destructive/20"
                    aria-label="Excluir pessoa"
                    title="Excluir pessoa"
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
                  onClick={savePerson}
                  className="sipi-cta-green rounded-lg px-4 py-2.5 text-sm font-bold transition"
                >
                  {editingId ? "Salvar alterações" : "Adicionar pessoa"}
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
