import { CarFront, ExternalLink, Link2, Plus, Search, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { VehicleListRecord } from "@/features/vehicles/vehicleTypes";
import { getErrorMessage } from "@/lib/errorMessage";
import type { NexoVeiculoTipoPosse, NexoVeiculoVinculo } from "../nexoTypes";

type Target = { kind: "person"; id: string } | { kind: "organization"; id: string };

const POSSESSION_LABELS: Record<NexoVeiculoTipoPosse, string> = {
  posse: "Em posse",
  uso_frequente: "Uso frequente",
  associado: "Associado",
  apreendido: "Apreendido",
  historico: "Histórico",
};

export function NexoVehiclePanel({ target, preview }: { target: Target; preview: boolean }) {
  const [links, setLinks] = useState<NexoVeiculoVinculo[]>([]);
  const [vehicles, setVehicles] = useState<VehicleListRecord[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [possession, setPossession] = useState<NexoVeiculoTipoPosse>("associado");
  const [confidence, setConfidence] = useState(50);
  const [source, setSource] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function reload() {
    if (preview) return;
    const [repo, vehiclesRepo] = await Promise.all([
      import("@/lib/repositories/nexoRepository"),
      import("@/lib/repositories/vehiclesRepository"),
    ]);
    const [allLinks, foundVehicles] = await Promise.all([
      repo.listNexoVeiculosVinculados(),
      vehiclesRepo.listVehiclesPage({ limit: 100 }),
    ]);
    setLinks(
      allLinks.filter((link) =>
        target.kind === "person" ? link.pessoa_id === target.id : link.organizacao_id === target.id,
      ),
    );
    setVehicles(foundVehicles);
  }

  useEffect(() => {
    setError("");
    void reload().catch((cause) =>
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar os veículos."),
    );
    // O alvo é a identidade estável do dossiê; reload é intencionalmente local ao painel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, target.id, target.kind]);

  const available = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    const linkedIds = new Set(links.map((link) => link.veiculo_id));
    return vehicles
      .filter((vehicle) => !linkedIds.has(vehicle.id))
      .filter((vehicle) =>
        `${vehicle.plate || ""} ${vehicle.brand_model || ""} ${vehicle.internal_id}`
          .toLocaleLowerCase("pt-BR")
          .includes(normalized),
      )
      .slice(0, 8);
  }, [links, query, vehicles]);

  async function linkVehicle() {
    if (!selectedId) return;
    setSaving(true);
    setError("");
    try {
      const repo = await import("@/lib/repositories/nexoRepository");
      await repo.createNexoVeiculoVinculo({
        veiculo_id: selectedId,
        ...(target.kind === "person" ? { pessoa_id: target.id } : { organizacao_id: target.id }),
        tipo_posse: possession,
        confianca: confidence,
        fonte_resumo: source,
        observacoes: "",
      });
      setSelectedId("");
      setQuery("");
      setSource("");
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível vincular o veículo.");
    } finally {
      setSaving(false);
    }
  }

  async function unlink(id: string) {
    if (
      !window.confirm("Remover este vínculo veicular do dossiê? O veículo continuará cadastrado.")
    )
      return;
    setSaving(true);
    try {
      const repo = await import("@/lib/repositories/nexoRepository");
      await repo.softDeleteNexoVeiculoVinculo(id);
      await reload();
    } catch (cause) {
      setError(getErrorMessage(cause, "Não foi possível remover o vínculo."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-[#1e405b]">Veículos relacionados</h3>
          <p className="mt-1 text-xs text-[#7d91a1]">
            O vínculo não duplica a ficha existente e mantém placa, fotos e procedimentos
            atualizados.
          </p>
        </div>
        <a
          href="/veiculos/novo?origem=nexo"
          className="inline-flex items-center gap-2 rounded-xl bg-[#173d5b] px-4 py-2.5 text-xs font-black text-white hover:bg-[#205575]"
        >
          <Plus className="h-4 w-4" /> Cadastrar novo veículo
        </a>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {links.map((link) => (
          <article
            key={link.id}
            className="relative rounded-2xl border border-[#d9e5ec] bg-white p-4 shadow-sm"
          >
            <button
              type="button"
              disabled={saving || preview}
              onClick={() => void unlink(link.id)}
              title="Remover vínculo"
              className="absolute right-3 top-3 rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-600 hover:bg-red-100 disabled:opacity-40"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex gap-3 pr-10">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eaf4f7] text-[#1689a1]">
                <CarFront className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <strong className="block truncate text-sm text-[#183b55]">
                  {link.veiculo.brand_model || "Veículo sem modelo informado"}
                </strong>
                <p className="mt-1 text-xs text-[#718697]">
                  {link.veiculo.plate || "Placa não informada"} ·{" "}
                  {link.veiculo.color || "Cor não informada"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-[#edf5f8] px-2 py-1 text-[10px] font-bold text-[#34778d]">
                    {POSSESSION_LABELS[link.tipo_posse]}
                  </span>
                  <span className="rounded-full bg-[#f3f5f7] px-2 py-1 text-[10px] font-bold text-[#718597]">
                    Confiança {link.confianca}%
                  </span>
                </div>
              </div>
            </div>
            <a
              href={`/veiculos/${link.veiculo_id}`}
              className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#21758e]"
            >
              Abrir ficha completa <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </article>
        ))}
      </div>

      {!links.length ? (
        <div className="rounded-2xl border border-dashed border-[#cadbe5] bg-white p-7 text-center">
          <CarFront className="mx-auto h-7 w-7 text-[#7ba2b2]" />
          <p className="mt-2 text-sm font-bold text-[#31546c]">Nenhum veículo relacionado</p>
          <p className="mt-1 text-xs text-[#8396a6]">
            Selecione uma ficha existente ou cadastre um veículo novo.
          </p>
        </div>
      ) : null}

      {!preview ? (
        <section className="rounded-2xl border border-[#d9e5ec] bg-[#f4f8fa] p-4">
          <h4 className="flex items-center gap-2 text-sm font-black text-[#203e57]">
            <Link2 className="h-4 w-4 text-[#1689a1]" /> Vincular veículo já cadastrado
          </h4>
          <label className="relative mt-3 block">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-[#8ba0af]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar placa, modelo ou código interno"
              className="h-11 w-full rounded-xl border border-[#d5e2ea] bg-white pl-10 pr-3 text-sm outline-none focus:border-[#3995aa]"
            />
          </label>
          {query.trim() ? (
            <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
              {available.map((vehicle) => (
                <button
                  key={vehicle.id}
                  type="button"
                  onClick={() => setSelectedId(vehicle.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left ${selectedId === vehicle.id ? "border-[#4ca8b9] bg-[#e9f7f9]" : "border-transparent bg-white hover:border-[#c9dce5]"}`}
                >
                  <CarFront className="h-4 w-4 text-[#4c8da1]" />
                  <span className="min-w-0 flex-1 truncate text-xs font-bold text-[#345268]">
                    {vehicle.plate || "Sem placa"} · {vehicle.brand_model || vehicle.internal_id}
                  </span>
                  {selectedId === vehicle.id ? (
                    <ShieldCheck className="h-4 w-4 text-[#1689a1]" />
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_130px_1.3fr_auto]">
            <select
              value={possession}
              onChange={(event) => setPossession(event.target.value as NexoVeiculoTipoPosse)}
              className="h-11 rounded-xl border border-[#d5e2ea] bg-white px-3 text-xs font-bold text-[#486377]"
            >
              {Object.entries(POSSESSION_LABELS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              max="100"
              value={confidence}
              onChange={(event) => setConfidence(Number(event.target.value))}
              aria-label="Confiança"
              className="h-11 rounded-xl border border-[#d5e2ea] bg-white px-3 text-xs"
            />
            <input
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder="Fonte resumida"
              className="h-11 rounded-xl border border-[#d5e2ea] bg-white px-3 text-xs"
            />
            <button
              type="button"
              disabled={!selectedId || saving}
              onClick={() => void linkVehicle()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1689a1] px-4 text-xs font-black text-white disabled:opacity-40"
            >
              <Plus className="h-4 w-4" /> Vincular
            </button>
          </div>
        </section>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
