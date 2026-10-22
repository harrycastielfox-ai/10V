import { CarFront, ExternalLink, Link2, Plus, Search, ShieldCheck, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  VEHICLE_SITUATIONS,
  VEHICLE_TYPES,
  type VehicleListRecord,
  type VehicleSituation,
  type VehicleType,
} from "@/features/vehicles/vehicleTypes";
import { useDebouncedValue } from "@/features/vehicles/useDebouncedValue";
import { getErrorMessage } from "@/lib/errorMessage";
import type { NexoVeiculoLocal, NexoVeiculoTipoPosse, NexoVeiculoVinculo } from "../nexoTypes";

type Target = { kind: "person"; id: string } | { kind: "organization"; id: string };

const POSSESSION_LABELS: Record<NexoVeiculoTipoPosse, string> = {
  posse: "Em posse",
  uso_frequente: "Uso frequente",
  associado: "Associado",
  apreendido: "Apreendido",
  historico: "Histórico",
};

const previewLinks = new Map<string, NexoVeiculoVinculo[]>();

type QuickVehicleForm = {
  vehicleType: VehicleType;
  plate: string;
  brandModel: string;
  manufactureYear: string;
  modelYear: string;
  color: string;
  renavam: string;
  engineNumber: string;
  chassis: string;
  cityState: string;
  bodyNumber: string;
  ownerName: string;
  ownerDocument: string;
  situation: VehicleSituation | "";
  detranUpdatedAt: string;
};

const emptyQuickVehicle: QuickVehicleForm = {
  vehicleType: "automovel",
  plate: "",
  brandModel: "",
  manufactureYear: "",
  modelYear: "",
  color: "",
  renavam: "",
  engineNumber: "",
  chassis: "",
  cityState: "",
  bodyNumber: "",
  ownerName: "",
  ownerDocument: "",
  situation: "",
  detranUpdatedAt: "",
};

const quickFieldClass =
  "h-11 w-full rounded-xl border border-[#d5e2ea] bg-white px-3 text-sm text-[#27495f] outline-none placeholder:text-[#91a2ae] focus:border-[#3995aa]";

function QuickField({
  label,
  wide = false,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={wide ? "sm:col-span-2" : ""}>
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[.1em] text-[#668093]">
        {label}
      </span>
      {children}
    </label>
  );
}

function VehicleFact({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="min-w-0 border-b border-[#edf2f5] py-2.5">
      <dt className="text-[10px] font-black uppercase tracking-[.08em] text-[#78909f]">{label}</dt>
      <dd className="mt-1 break-words text-xs font-bold text-[#294b62]">
        {value === null || value === "" ? "Não informado" : value}
      </dd>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return null;
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

const previewVehicles: VehicleListRecord[] = [
  "Motocicleta demonstrativa",
  "Automóvel demonstrativo",
  "Utilitário demonstrativo",
].map((model, index) => ({
  id: `demo-vehicle-${index + 1}`,
  internal_id: `VEICULO-DEMO-0${index + 1}`,
  vehicle_type: index === 0 ? "motocicleta" : "automovel",
  brand_model: model,
  color: ["Vermelha", "Branca", "Azul"][index],
  plate: `DEMO-0${index + 1}`,
  situation: null,
  occurrence_type: null,
  procedure_type: null,
  procedure_number: null,
  police_report_number: null,
  custody_location: null,
  storage_location: null,
  pending_identification: false,
  updated_at: "2026-10-18T00:00:00.000Z",
  total_count: 3,
}));

export function NexoVehiclePanel({ target, preview }: { target: Target; preview: boolean }) {
  const [links, setLinks] = useState<NexoVeiculoVinculo[]>([]);
  const [localVehicles, setLocalVehicles] = useState<NexoVeiculoLocal[]>([]);
  const [vehicles, setVehicles] = useState<VehicleListRecord[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [possession, setPossession] = useState<NexoVeiculoTipoPosse>("associado");
  const [confidence, setConfidence] = useState(50);
  const [source, setSource] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [showQuickForm, setShowQuickForm] = useState(false);
  const [quickVehicle, setQuickVehicle] = useState<QuickVehicleForm>(emptyQuickVehicle);
  const search = useDebouncedValue(query.trim());
  const scopeKey = `${target.kind}:${target.id}`;
  const currentScope = useRef(scopeKey);
  currentScope.current = scopeKey;

  const reload = useCallback(async () => {
    if (preview || currentScope.current !== scopeKey) return;
    const repo = await import("@/lib/repositories/nexoRepository");
    const [allLinks, localRecords] = await Promise.all([
      repo.listNexoVeiculosVinculados(),
      repo.listNexoVeiculosLocais(
        target.kind === "person" ? { pessoa_id: target.id } : { organizacao_id: target.id },
      ),
    ]);
    if (currentScope.current === scopeKey) {
      setLocalVehicles(localRecords);
      setLinks(
        allLinks.filter((link) =>
          target.kind === "person"
            ? link.pessoa_id === target.id
            : link.organizacao_id === target.id,
        ),
      );
    }
  }, [preview, scopeKey, target.id, target.kind]);

  useEffect(() => {
    let cancelled = false;
    setLinks(preview ? (previewLinks.get(scopeKey) ?? []) : []);
    setLocalVehicles([]);
    setShowLinkForm(false);
    setShowQuickForm(false);
    setQuickVehicle(emptyQuickVehicle);
    setSelectedId("");
    setQuery("");
    setSource("");
    setError("");
    void reload().catch((cause) => {
      if (!cancelled) setError(getErrorMessage(cause, "Não foi possível carregar os veículos."));
    });
    return () => {
      cancelled = true;
    };
  }, [reload, preview, scopeKey]);

  useEffect(() => {
    let cancelled = false;
    setVehicles([]);
    if (!search) {
      setSearching(false);
      return;
    }
    if (preview) {
      const term = search.toLocaleLowerCase("pt-BR");
      setVehicles(
        previewVehicles.filter((vehicle) =>
          [vehicle.plate, vehicle.brand_model, vehicle.internal_id].some((value) =>
            value?.toLocaleLowerCase("pt-BR").includes(term),
          ),
        ),
      );
      setSearching(false);
      return;
    }
    setSearching(true);
    void import("@/lib/repositories/vehiclesRepository")
      .then((repo) => repo.listVehiclesPage({ limit: 100, search }))
      .then((found) => {
        if (!cancelled) setVehicles(found);
      })
      .catch((cause) => {
        if (!cancelled) setError(getErrorMessage(cause, "Não foi possível buscar os veículos."));
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [preview, search, scopeKey]);

  const available = useMemo(() => {
    const linkedIds = new Set(links.map((link) => link.veiculo_id));
    return vehicles.filter((vehicle) => !linkedIds.has(vehicle.id)).slice(0, 8);
  }, [links, vehicles]);

  async function linkVehicle() {
    if (!selectedId || saving || !Number.isFinite(confidence) || confidence < 0 || confidence > 100)
      return;
    if (preview) {
      const vehicle = previewVehicles.find((item) => item.id === selectedId);
      if (!vehicle || links.some((link) => link.veiculo_id === selectedId)) return;
      const next: NexoVeiculoVinculo[] = [
        ...links,
        {
          id: `demo-link-${target.kind}-${target.id}-${vehicle.id}`,
          veiculo_id: vehicle.id,
          pessoa_id: target.kind === "person" ? target.id : null,
          organizacao_id: target.kind === "organization" ? target.id : null,
          tipo_posse: possession,
          confianca: confidence,
          fonte_resumo: source || null,
          observacoes: "Vínculo fictício para demonstração.",
          created_at: new Date().toISOString(),
          veiculo: vehicle,
        },
      ];
      previewLinks.set(scopeKey, next);
      setLinks(next);
      setSelectedId("");
      setQuery("");
      setSource("");
      setShowLinkForm(false);
      return;
    }
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
      setShowLinkForm(false);
    } catch (cause) {
      setError(getErrorMessage(cause, "Não foi possível vincular o veículo."));
    } finally {
      setSaving(false);
    }
  }

  async function createLocalVehicle() {
    if (saving) return;
    const brandModel = quickVehicle.brandModel.trim();
    const hasIdentifier = [
      quickVehicle.plate,
      quickVehicle.renavam,
      quickVehicle.engineNumber,
      quickVehicle.chassis,
    ].some((value) => value.trim());
    if (!brandModel || !hasIdentifier) {
      setError("Informe a marca/modelo e ao menos placa, RENAVAM, motor ou chassi.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const nexoRepo = await import("@/lib/repositories/nexoRepository");
      await nexoRepo.createNexoVeiculoLocal({
        pessoa_id: target.kind === "person" ? target.id : null,
        organizacao_id: target.kind === "organization" ? target.id : null,
        tipo: quickVehicle.vehicleType,
        placa: quickVehicle.plate.trim() || null,
        marca_modelo: brandModel,
        ano_fabricacao: quickVehicle.manufactureYear ? Number(quickVehicle.manufactureYear) : null,
        ano_modelo: quickVehicle.modelYear ? Number(quickVehicle.modelYear) : null,
        cor: quickVehicle.color.trim() || null,
        renavam: quickVehicle.renavam.trim() || null,
        numero_motor: quickVehicle.engineNumber.trim() || null,
        chassi: quickVehicle.chassis.trim() || null,
        cidade_estado: quickVehicle.cityState.trim() || null,
        numero_carroceria: quickVehicle.bodyNumber.trim() || null,
        proprietario_nome: quickVehicle.ownerName.trim() || null,
        proprietario_documento: quickVehicle.ownerDocument.trim() || null,
        situacao: quickVehicle.situation || null,
        detran_atualizado_em: quickVehicle.detranUpdatedAt || null,
        tipo_posse: "associado",
        confianca: 50,
        fonte_resumo: "Cadastro realizado diretamente no dossiê NEXO",
        observacoes: null,
      });
      setQuickVehicle(emptyQuickVehicle);
      setShowQuickForm(false);
      await reload();
    } catch (cause) {
      setError(getErrorMessage(cause, "Não foi possível cadastrar o veículo no NEXO."));
    } finally {
      setSaving(false);
    }
  }

  async function removeLocalVehicle(id: string) {
    if (
      !window.confirm(
        "Excluir esta ficha veicular do NEXO? Essa ação não altera os Veículos Apreendidos do SIED.",
      )
    )
      return;
    setSaving(true);
    setError("");
    try {
      const repo = await import("@/lib/repositories/nexoRepository");
      await repo.softDeleteNexoVeiculoLocal(id);
      await reload();
    } catch (cause) {
      setError(getErrorMessage(cause, "Não foi possível excluir a ficha veicular do NEXO."));
    } finally {
      setSaving(false);
    }
  }

  async function unlink(id: string) {
    if (
      !window.confirm("Remover este vínculo veicular do dossiê? O veículo continuará cadastrado.")
    )
      return;
    if (preview) {
      const next = links.filter((link) => link.id !== id);
      previewLinks.set(scopeKey, next);
      setLinks(next);
      return;
    }
    setSaving(true);
    setError("");
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
          <h3 className="text-sm font-black text-[#1e405b]">Veículos do dossiê</h3>
          <p className="mt-1 text-xs text-[#7d91a1]">
            O cadastro feito aqui pertence somente ao NEXO. O vínculo com o SIED é uma ação separada
            e opcional.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setShowLinkForm((shown) => !shown);
              setShowQuickForm(false);
              setError("");
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-[#a6cbd5] bg-white px-4 py-2.5 text-xs font-black text-[#17677e] hover:bg-[#edf8fa]"
          >
            <Link2 className="h-4 w-4" />{" "}
            {showLinkForm ? "Fechar busca" : "Vincular veículo cadastrado"}
          </button>
          {!preview ? (
            <button
              type="button"
              onClick={() => {
                setShowQuickForm((shown) => !shown);
                setShowLinkForm(false);
                setError("");
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#173d5b] px-4 py-2.5 text-xs font-black text-white hover:bg-[#205575]"
            >
              <Plus className="h-4 w-4" /> {showQuickForm ? "Fechar cadastro" : "Cadastrar no NEXO"}
            </button>
          ) : null}
        </div>
      </div>

      {localVehicles.length ? (
        <section className="space-y-3">
          <div>
            <h4 className="text-xs font-black uppercase tracking-[.08em] text-[#31566d]">
              Fichas exclusivas do NEXO
            </h4>
            <p className="mt-1 text-[11px] text-[#7b909f]">
              Estes veículos não aparecem no módulo de Veículos Apreendidos.
            </p>
          </div>
          <div className="space-y-3">
            {localVehicles.map((vehicle) => (
              <article
                key={vehicle.id}
                className="relative overflow-hidden rounded-2xl border border-[#cfe0e7] bg-white shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#dce8ed] bg-[#f3f8fa] px-5 py-4">
                  <div className="flex min-w-0 gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#dff1f5] text-[#1689a1]">
                      <CarFront className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <span className="text-[10px] font-black uppercase tracking-[.1em] text-[#43879a]">
                        Ficha veicular NEXO
                      </span>
                      <strong className="mt-0.5 block text-sm text-[#183b55]">
                        {vehicle.marca_modelo}
                      </strong>
                      <p className="mt-1 text-xs text-[#718697]">
                        {vehicle.placa || "Placa não informada"} ·{" "}
                        {vehicle.cor || "Cor não informada"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void removeLocalVehicle(vehicle.id)}
                    title="Excluir ficha do NEXO"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100 disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" /> Excluir ficha
                  </button>
                </div>
                <dl className="grid gap-x-6 px-5 py-2 sm:grid-cols-2 lg:grid-cols-4">
                  <VehicleFact label="Tipo" value={vehicle.tipo.replaceAll("_", " ")} />
                  <VehicleFact label="Placa" value={vehicle.placa} />
                  <VehicleFact label="RENAVAM" value={vehicle.renavam} />
                  <VehicleFact label="Chassi" value={vehicle.chassi} />
                  <VehicleFact label="Número do motor" value={vehicle.numero_motor} />
                  <VehicleFact label="Número da carroceria" value={vehicle.numero_carroceria} />
                  <VehicleFact
                    label="Ano modelo / fabricação"
                    value={
                      vehicle.ano_modelo || vehicle.ano_fabricacao
                        ? `${vehicle.ano_modelo ?? "—"} / ${vehicle.ano_fabricacao ?? "—"}`
                        : null
                    }
                  />
                  <VehicleFact label="Cidade / Estado" value={vehicle.cidade_estado} />
                  <VehicleFact label="Proprietário informado" value={vehicle.proprietario_nome} />
                  <VehicleFact
                    label="CPF/CNPJ do proprietário"
                    value={vehicle.proprietario_documento}
                  />
                  <VehicleFact
                    label="Situação informada"
                    value={vehicle.situacao?.replaceAll("_", " ") ?? null}
                  />
                  <VehicleFact
                    label="Atualização Detran"
                    value={formatDate(vehicle.detran_atualizado_em)}
                  />
                </dl>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {links.length ? (
        <div>
          <h4 className="text-xs font-black uppercase tracking-[.08em] text-[#31566d]">
            Vínculos com Veículos Apreendidos do SIED
          </h4>
          <p className="mt-1 text-[11px] text-[#7b909f]">
            Referências opcionais a fichas já existentes no cadastro geral.
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {links.map((link) => (
          <article
            key={link.id}
            className="relative rounded-2xl border border-[#d9e5ec] bg-white p-4 shadow-sm"
          >
            <button
              type="button"
              disabled={saving}
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
                  {link.veiculo?.brand_model ||
                    (link.veiculo ? "Veículo sem modelo informado" : "Veículo indisponível")}
                </strong>
                <p className="mt-1 text-xs text-[#718697]">
                  {link.veiculo?.plate || "Placa não informada"} ·{" "}
                  {link.veiculo?.color || "Cor não informada"}
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
            {link.veiculo && !preview ? (
              <a
                href={`/veiculos/${link.veiculo_id}`}
                className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#21758e]"
              >
                Abrir ficha completa <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </article>
        ))}
      </div>

      {!links.length && !localVehicles.length ? (
        <div className="rounded-2xl border border-dashed border-[#cadbe5] bg-white p-7 text-center">
          <CarFront className="mx-auto h-7 w-7 text-[#7ba2b2]" />
          <p className="mt-2 text-sm font-bold text-[#31546c]">Nenhum veículo relacionado</p>
          <p className="mt-1 text-xs text-[#8396a6]">
            Cadastre uma ficha exclusiva do NEXO ou vincule um veículo já existente no SIED.
          </p>
        </div>
      ) : null}

      {showLinkForm ? (
        <section className="rounded-2xl border border-[#d9e5ec] bg-[#f4f8fa] p-4">
          <h4 className="flex items-center gap-2 text-sm font-black text-[#203e57]">
            <Link2 className="h-4 w-4 text-[#1689a1]" /> Vincular veículo já cadastrado
          </h4>
          {preview ? (
            <p className="mt-2 text-xs font-semibold text-[#6b7f8e]">
              Demonstração: pesquise “DEMO” ou “demonstrativo”. Vínculos são temporários e não
              acessam o cadastro real.
            </p>
          ) : null}
          <label className="relative mt-3 block">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-[#8ba0af]" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedId("");
              }}
              placeholder="Buscar placa, modelo ou código interno"
              className="h-11 w-full rounded-xl border border-[#d5e2ea] bg-white pl-10 pr-3 text-sm outline-none focus:border-[#3995aa]"
            />
          </label>
          {query.trim() ? (
            <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
              {searching || search !== query.trim() ? (
                <p role="status" className="p-2 text-xs text-[#718697]">
                  Buscando veículos…
                </p>
              ) : !available.length ? (
                <p role="status" className="p-2 text-xs text-[#718697]">
                  Nenhum veículo disponível para esta busca.
                </p>
              ) : null}
              {search === query.trim() &&
                available.map((vehicle) => (
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
              disabled={
                !selectedId ||
                saving ||
                searching ||
                search !== query.trim() ||
                !Number.isFinite(confidence) ||
                confidence < 0 ||
                confidence > 100
              }
              onClick={() => void linkVehicle()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1689a1] px-4 text-xs font-black text-white disabled:opacity-40"
            >
              <Plus className="h-4 w-4" /> Vincular
            </button>
          </div>
        </section>
      ) : null}
      {showQuickForm && !preview ? (
        <section className="rounded-2xl border border-[#bdd6df] bg-[#f5fafb] p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="flex items-center gap-2 text-sm font-black text-[#203e57]">
                <CarFront className="h-4 w-4 text-[#1689a1]" /> Cadastro rápido de veículo
              </h4>
              <p className="mt-1 text-xs text-[#6f8595]">
                Informe os dados disponíveis. A ficha ficará somente neste dossiê do NEXO e não será
                enviada para Veículos Apreendidos.
              </p>
            </div>
            <button
              type="button"
              aria-label="Fechar cadastro rápido"
              onClick={() => setShowQuickForm(false)}
              className="rounded-lg border border-[#cbdce4] bg-white p-2 text-[#557083] hover:bg-[#edf4f7]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <QuickField label="Tipo">
              <select
                value={quickVehicle.vehicleType}
                onChange={(event) =>
                  setQuickVehicle((current) => ({
                    ...current,
                    vehicleType: event.target.value as VehicleType,
                  }))
                }
                className={quickFieldClass}
              >
                {VEHICLE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
            </QuickField>
            <QuickField label="Placa">
              <input
                value={quickVehicle.plate}
                onChange={(event) =>
                  setQuickVehicle((current) => ({
                    ...current,
                    plate: event.target.value.toUpperCase(),
                  }))
                }
                className={quickFieldClass}
                placeholder="ABC1D23"
              />
            </QuickField>
            <QuickField label="Marca / Modelo" wide>
              <input
                value={quickVehicle.brandModel}
                onChange={(event) =>
                  setQuickVehicle((current) => ({ ...current, brandModel: event.target.value }))
                }
                className={quickFieldClass}
                placeholder="HONDA / NXR 160 BROS CBS"
              />
            </QuickField>
            <QuickField label="Ano fabricação">
              <input
                type="number"
                min="1900"
                max="2100"
                value={quickVehicle.manufactureYear}
                onChange={(event) =>
                  setQuickVehicle((current) => ({
                    ...current,
                    manufactureYear: event.target.value,
                  }))
                }
                className={quickFieldClass}
                placeholder="2025"
              />
            </QuickField>
            <QuickField label="Ano modelo">
              <input
                type="number"
                min="1900"
                max="2100"
                value={quickVehicle.modelYear}
                onChange={(event) =>
                  setQuickVehicle((current) => ({ ...current, modelYear: event.target.value }))
                }
                className={quickFieldClass}
                placeholder="2026"
              />
            </QuickField>
            <QuickField label="Cor">
              <input
                value={quickVehicle.color}
                onChange={(event) =>
                  setQuickVehicle((current) => ({ ...current, color: event.target.value }))
                }
                className={quickFieldClass}
                placeholder="Azul"
              />
            </QuickField>
            <QuickField label="Cidade / Estado">
              <input
                value={quickVehicle.cityState}
                onChange={(event) =>
                  setQuickVehicle((current) => ({ ...current, cityState: event.target.value }))
                }
                className={quickFieldClass}
                placeholder="Porto Seguro/BA"
              />
            </QuickField>
            <QuickField label="RENAVAM">
              <input
                value={quickVehicle.renavam}
                onChange={(event) =>
                  setQuickVehicle((current) => ({ ...current, renavam: event.target.value }))
                }
                className={quickFieldClass}
              />
            </QuickField>
            <QuickField label="Número do motor">
              <input
                value={quickVehicle.engineNumber}
                onChange={(event) =>
                  setQuickVehicle((current) => ({ ...current, engineNumber: event.target.value }))
                }
                className={quickFieldClass}
              />
            </QuickField>
            <QuickField label="Chassi" wide>
              <input
                value={quickVehicle.chassis}
                onChange={(event) =>
                  setQuickVehicle((current) => ({
                    ...current,
                    chassis: event.target.value.toUpperCase(),
                  }))
                }
                className={quickFieldClass}
              />
            </QuickField>
            <QuickField label="Número da carroceria">
              <input
                value={quickVehicle.bodyNumber}
                onChange={(event) =>
                  setQuickVehicle((current) => ({ ...current, bodyNumber: event.target.value }))
                }
                className={quickFieldClass}
              />
            </QuickField>
            <QuickField label="Nome do proprietário" wide>
              <input
                value={quickVehicle.ownerName}
                onChange={(event) =>
                  setQuickVehicle((current) => ({ ...current, ownerName: event.target.value }))
                }
                className={quickFieldClass}
              />
            </QuickField>
            <QuickField label="CPF/CNPJ do proprietário">
              <input
                value={quickVehicle.ownerDocument}
                onChange={(event) =>
                  setQuickVehicle((current) => ({ ...current, ownerDocument: event.target.value }))
                }
                className={quickFieldClass}
              />
            </QuickField>
            <QuickField label="Situação do veículo" wide>
              <select
                value={quickVehicle.situation}
                onChange={(event) =>
                  setQuickVehicle((current) => ({
                    ...current,
                    situation: event.target.value as VehicleSituation | "",
                  }))
                }
                className={quickFieldClass}
              >
                <option value="">Não informada</option>
                {VEHICLE_SITUATIONS.map((situation) => (
                  <option key={situation} value={situation}>
                    {situation.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </QuickField>
            <QuickField label="Última atualização Detran">
              <input
                type="date"
                value={quickVehicle.detranUpdatedAt}
                onChange={(event) =>
                  setQuickVehicle((current) => ({
                    ...current,
                    detranUpdatedAt: event.target.value,
                  }))
                }
                className={quickFieldClass}
              />
            </QuickField>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#d9e6ec] pt-4">
            <p className="text-[11px] text-[#6e8494]">
              Marca/modelo e ao menos um identificador são obrigatórios para evitar fichas soltas.
            </p>
            <button
              type="button"
              disabled={saving}
              onClick={() => void createLocalVehicle()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1689a1] px-5 text-xs font-black text-white hover:bg-[#11758a] disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> {saving ? "Cadastrando…" : "Salvar ficha no NEXO"}
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
