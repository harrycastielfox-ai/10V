import { Plus, Save, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { NexoOrganizacao, NexoPessoa, NexoVinculoStatus } from "../nexoTypes";

export interface NexoLinkInput {
  pessoa_id: string;
  organizacao_id: string;
  status: NexoVinculoStatus;
  funcao: string;
  confianca: number;
  fonte_resumo: string;
  superior_vinculo_id: string | null;
}

const field =
  "h-10 w-full rounded-xl border border-[#d9e5ed] bg-white px-3 text-sm text-[#18384f] outline-none focus:border-[#33a0b4]";

export function NexoLinkForm({
  person,
  organizations,
  people,
  onSave,
}: {
  person: NexoPessoa;
  organizations: NexoOrganizacao[];
  people: NexoPessoa[];
  onSave: (input: NexoLinkInput) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [organizationId, setOrganizationId] = useState("");
  const [status, setStatus] = useState<NexoVinculoStatus>("nao_confirmado");
  const [confidence, setConfidence] = useState(0);
  const [role, setRole] = useState("");
  const [source, setSource] = useState("");
  const [superiorId, setSuperiorId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const available = organizations.filter(
    (item) => !person.vinculos.some((link) => link.organizacao_id === item.id),
  );
  const possibleSuperiors = people.flatMap((item) =>
    item.id === person.id
      ? []
      : item.vinculos
          .filter(
            (link) => link.organizacao_id === organizationId && link.status !== "desvinculado",
          )
          .map((link) => ({ name: item.nome, link })),
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({
        pessoa_id: person.id,
        organizacao_id: organizationId,
        status,
        funcao: role,
        confianca: confidence,
        fonte_resumo: source,
        superior_vinculo_id: superiorId || null,
      });
      setOpen(false);
      setOrganizationId("");
      setStatus("nao_confirmado");
      setConfidence(0);
      setRole("");
      setSource("");
      setSuperiorId("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao registrar o vínculo.");
    } finally {
      setSaving(false);
    }
  }

  if (!available.length) return null;
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-[#bddbe3] bg-[#edf8fa] px-4 py-2.5 text-xs font-bold text-[#176c84]"
      >
        <Plus className="h-4 w-4" /> Adicionar vínculo
      </button>
    );
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="rounded-2xl border border-[#cbdfe8] bg-white p-5 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-[#1e405b]">Novo vínculo avaliado</h3>
          <p className="mt-1 text-xs text-[#7b8e9e]">
            A classificação descreve a evidência disponível, não uma conclusão automática.
          </p>
        </div>
        <button
          type="button"
          aria-label="Cancelar vínculo"
          onClick={() => setOpen(false)}
          className="rounded-lg p-2 text-[#8295a4] hover:bg-[#f2f6f8]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-[#637b8e]">
          Organização
          <select
            required
            className={`mt-1 ${field}`}
            value={organizationId}
            onChange={(event) => {
              setOrganizationId(event.target.value);
              setSuperiorId("");
            }}
          >
            <option value="">Selecione…</option>
            {available.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold text-[#637b8e] sm:col-span-2">
          Responde a
          <select
            className={`mt-1 ${field}`}
            value={superiorId}
            onChange={(event) => setSuperiorId(event.target.value)}
            disabled={!organizationId || status === "desvinculado"}
          >
            <option value="">Sem superior definido</option>
            {possibleSuperiors.map(({ name, link }) => (
              <option key={link.id} value={link.id}>
                {name} · {link.funcao || "Função não informada"}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold text-[#637b8e]">
          Situação do vínculo
          <select
            className={`mt-1 ${field}`}
            value={status}
            onChange={(event) => setStatus(event.target.value as NexoVinculoStatus)}
          >
            <option value="nao_confirmado">Não confirmado</option>
            <option value="suspeito">Suspeito</option>
            <option value="provavel">Provável</option>
            <option value="confirmado">Confirmado</option>
            <option value="desvinculado">Desvinculado</option>
          </select>
        </label>
        <label className="text-xs font-bold text-[#637b8e]">
          Função ou relação
          <input
            className={`mt-1 ${field}`}
            value={role}
            onChange={(event) => setRole(event.target.value)}
            placeholder="Se houver informação"
          />
        </label>
        <label className="text-xs font-bold text-[#637b8e]">
          Confiança (0–100)
          <input
            type="number"
            min="0"
            max="100"
            className={`mt-1 ${field}`}
            value={confidence}
            onChange={(event) => setConfidence(Number(event.target.value))}
          />
        </label>
        <label className="text-xs font-bold text-[#637b8e] sm:col-span-2">
          Fonte e fundamento
          <textarea
            required
            className="mt-1 min-h-20 w-full rounded-xl border border-[#d9e5ed] bg-white px-3 py-2 text-sm text-[#18384f] outline-none focus:border-[#33a0b4]"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder="Origem, data e motivo desta avaliação"
          />
        </label>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-xs text-red-700">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={saving}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#173d5b] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        {saving ? "Salvando…" : "Registrar vínculo"}
      </button>
    </form>
  );
}
