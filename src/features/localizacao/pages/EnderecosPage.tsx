import {
  AlertTriangle,
  CircleOff,
  Building2,
  CheckCircle2,
  ExternalLink,
  House,
  Link2,
  ListChecks,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import {
  confirmarBairroEndereco,
  createEndereco,
  listBairrosOperacionais,
  listEnderecos,
  listEnderecosPendentes,
  marcarBairroNaoIdentificado,
  softDeleteEndereco,
} from "@/lib/repositories/localizacaoRepository";
import { MUNICIPIO_PADRAO, UF_PADRAO } from "../localizacaoConstants";
import type { BairroOperacionalRecord, EnderecoRecord } from "../localizacaoTypes";

const fieldClass =
  "mt-2 min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-operational/50";

export default function EnderecosPage() {
  const [searchInput, setSearchInput] = useState("");
  const [addresses, setAddresses] = useState<EnderecoRecord[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [noNumber, setNoNumber] = useState(false);
  const [complement, setComplement] = useState("");
  const [neighborhoodId, setNeighborhoodId] = useState("");
  const [neighborhoods, setNeighborhoods] = useState<BairroOperacionalRecord[]>([]);
  const [classifyingAddress, setClassifyingAddress] = useState<EnderecoRecord | null>(null);
  const [classificationId, setClassificationId] = useState("");
  const [classificationSaving, setClassificationSaving] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewQueue, setReviewQueue] = useState<EnderecoRecord[]>([]);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [reviewInitialTotal, setReviewInitialTotal] = useState(0);
  const [reviewProcessed, setReviewProcessed] = useState(0);
  const [reviewNeighborhoodId, setReviewNeighborhoodId] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [city, setCity] = useState(MUNICIPIO_PADRAO);
  const [uf, setUf] = useState(UF_PADRAO);
  const [cep, setCep] = useState("");
  const [reference, setReference] = useState("");
  const [howToGetThere, setHowToGetThere] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [deletingAddress, setDeletingAddress] = useState<EnderecoRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void listBairrosOperacionais()
      .then((records) => {
        if (!cancelled) setNeighborhoods(records);
      })
      .catch((error) => {
        console.error("[EnderecosPage] Falha ao carregar bairros", error);
        if (!cancelled) setMessage("Não foi possível carregar o catálogo de bairros.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void listEnderecos(searchInput).then((records) => {
        if (!cancelled) setAddresses(records);
      });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchInput]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!street.trim() || !city.trim() || !uf.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const selectedNeighborhood = neighborhoods.find((item) => item.id === neighborhoodId) ?? null;
      await createEndereco({
        logradouro: street.trim(),
        numero: noNumber ? null : number.trim() || null,
        sem_numero: noNumber,
        complemento: complement.trim() || null,
        bairro: selectedNeighborhood?.nome ?? null,
        bairro_id: selectedNeighborhood?.id ?? null,
        bairro_status: selectedNeighborhood ? "confirmado" : "pendente",
        municipio: city.trim(),
        uf: uf.trim().toUpperCase(),
        cep: cep.trim() || null,
        ponto_referencia: reference.trim() || null,
        como_chegar: howToGetThere.trim() || null,
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
        maps_url: mapsUrl.trim() || null,
        confirmado: confirmed,
        observacoes: notes.trim() || null,
      });
      setAddresses(await listEnderecos(searchInput));
      setStreet("");
      setNumber("");
      setNoNumber(false);
      setComplement("");
      setNeighborhoodId("");
      setCity(MUNICIPIO_PADRAO);
      setUf(UF_PADRAO);
      setCep("");
      setReference("");
      setHowToGetThere("");
      setLatitude("");
      setLongitude("");
      setMapsUrl("");
      setConfirmed(false);
      setNotes("");
      setFormOpen(false);
      setMessage("Endereço cadastrado com sucesso.");
    } catch (error) {
      console.error("[EnderecosPage] Falha ao criar endereço", error);
      setMessage("Não foi possível cadastrar o endereço.");
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmClassification() {
    if (!classifyingAddress || !classificationId) return;
    const selectedNeighborhood = neighborhoods.find((item) => item.id === classificationId);
    if (!selectedNeighborhood) return;
    setClassificationSaving(true);
    setMessage(null);
    try {
      await confirmarBairroEndereco(classifyingAddress.id, selectedNeighborhood);
      setAddresses(await listEnderecos(searchInput));
      setClassifyingAddress(null);
      setClassificationId("");
      setMessage(`Bairro ${selectedNeighborhood.nome} confirmado para o endereço.`);
    } catch (error) {
      console.error("[EnderecosPage] Falha ao confirmar bairro", error);
      setMessage("Não foi possível confirmar o bairro do endereço.");
    } finally {
      setClassificationSaving(false);
    }
  }

  async function handleDeleteAddress() {
    if (!deletingAddress) return;
    setDeleting(true);
    setMessage(null);
    setDeleteError("");
    try {
      await softDeleteEndereco(deletingAddress.id);
      setAddresses((current) => current.filter((item) => item.id !== deletingAddress.id));
      setDeletingAddress(null);
      setMessage("Endereço excluído.");
    } catch (error) {
      console.error("[EnderecosPage] Falha ao excluir endereço", error);
      setMessage("Não foi possível excluir este endereço.");
      setDeleteError(
        error instanceof Error ? error.message : "Não foi possível excluir este endereço.",
      );
    } finally {
      setDeleting(false);
    }
  }

  async function openReviewQueue() {
    setReviewOpen(true);
    setReviewLoading(true);
    setReviewError("");
    setReviewQueue([]);
    setReviewTotal(0);
    setReviewInitialTotal(0);
    setReviewNeighborhoodId("");
    setReviewProcessed(0);
    try {
      const result = await listEnderecosPendentes();
      setReviewQueue(result.records);
      setReviewTotal(result.total);
      setReviewInitialTotal(result.total);
    } catch (error) {
      console.error("[EnderecosPage] Falha ao abrir fila territorial", error);
      setReviewError("Não foi possível carregar os endereços pendentes.");
    } finally {
      setReviewLoading(false);
    }
  }

  async function finishReviewDecision(action: "confirmar" | "nao_identificado") {
    const currentAddress = reviewQueue[0];
    if (!currentAddress || (action === "confirmar" && !reviewNeighborhoodId)) return;

    setReviewSaving(true);
    setReviewError("");
    try {
      let updatedAddress: EnderecoRecord;
      if (action === "confirmar") {
        const selectedNeighborhood = neighborhoods.find((item) => item.id === reviewNeighborhoodId);
        if (!selectedNeighborhood) return;
        updatedAddress = await confirmarBairroEndereco(currentAddress.id, selectedNeighborhood);
      } else {
        updatedAddress = await marcarBairroNaoIdentificado(currentAddress.id);
      }

      setAddresses((current) =>
        current.map((address) => (address.id === updatedAddress.id ? updatedAddress : address)),
      );
      const nextQueue = reviewQueue.slice(1);
      const nextTotal = Math.max(reviewTotal - 1, 0);
      setReviewProcessed((current) => current + 1);
      setReviewTotal(nextTotal);
      setReviewNeighborhoodId("");

      if (!nextQueue.length && nextTotal > 0) {
        const nextBatch = await listEnderecosPendentes();
        setReviewQueue(nextBatch.records);
        setReviewTotal(nextBatch.total);
      } else {
        setReviewQueue(nextQueue);
      }
    } catch (error) {
      console.error("[EnderecosPage] Falha ao revisar bairro", error);
      setReviewError("Não foi possível salvar esta decisão. O endereço continua pendente.");
    } finally {
      setReviewSaving(false);
    }
  }

  const pendingCount = addresses.filter((address) => address.bairro_status === "pendente").length;
  const confirmedCount = addresses.filter(
    (address) => address.bairro_status === "confirmado",
  ).length;
  const unidentifiedCount = addresses.filter(
    (address) => address.bairro_status === "nao_identificado",
  ).length;
  const reviewAddress = reviewQueue[0] ?? null;
  const reviewMapUrl = reviewAddress ? buildOsmPreviewUrl(reviewAddress) : null;
  const reviewProgress = reviewInitialTotal
    ? Math.min((reviewProcessed / reviewInitialTotal) * 100, 100)
    : 100;

  return (
    <div>
      <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-operational">
            Cadastros operacionais
          </p>
          <h1 className="mt-1 text-2xl font-black sm:text-3xl">Endereços</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Locais de interesse e referências para futuras diligências.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void openReviewQueue()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-warning/40 bg-warning/8 px-4 py-2.5 text-sm font-bold text-warning transition hover:bg-warning/15"
          >
            <ListChecks className="h-4 w-4" /> Revisar bairros
            {pendingCount ? (
              <span className="rounded-full bg-warning px-2 py-0.5 text-[10px] text-background">
                {pendingCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-operational px-4 py-2.5 text-sm font-bold text-[var(--operational-contrast)]"
          >
            <Plus className="h-4 w-4" /> Novo endereço
          </button>
        </div>
      </header>

      {message ? (
        <div className="mb-4 rounded-lg border border-operational/35 bg-operational/10 p-3 text-sm">
          {message}
        </div>
      ) : null}

      <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TerritorySummaryCard
          icon={Building2}
          label="Bairros catalogados"
          value={neighborhoods.length}
          tone="operational"
        />
        <TerritorySummaryCard
          icon={AlertTriangle}
          label="Pendentes de classificação"
          value={pendingCount}
          tone="warning"
        />
        <TerritorySummaryCard
          icon={ShieldCheck}
          label="Bairros confirmados"
          value={confirmedCount}
          tone="success"
        />
        <TerritorySummaryCard
          icon={CircleOff}
          label="Não identificados"
          value={unidentifiedCount}
          tone="neutral"
        />
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border p-4">
          <label className="flex min-h-11 max-w-xl items-center gap-2 rounded-lg border border-border bg-background px-3 focus-within:border-operational/50">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Buscar logradouro ou bairro"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
        </div>
        {addresses.length ? (
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {addresses.map((address) => (
              <article
                key={address.id}
                className="relative rounded-xl border border-border bg-background p-4"
              >
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError("");
                    setDeletingAddress(address);
                  }}
                  aria-label="Excluir este endereço"
                  title="Excluir este endereço"
                  className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-destructive/30 text-destructive/70 transition hover:border-destructive/60 hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="flex items-start gap-3 pr-8">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-operational/30 bg-operational/10 text-operational">
                    <House className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-black">
                      {address.logradouro}, {address.sem_numero ? "s/n" : (address.numero ?? "s/n")}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[address.bairro ?? "Bairro não classificado", address.municipio, address.uf]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold ${getAddressStatusClass(address)}`}
                  >
                    {address.bairro_status === "confirmado" ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : address.bairro_status === "nao_identificado" ? (
                      <CircleOff className="h-3 w-3" />
                    ) : (
                      <AlertTriangle className="h-3 w-3" />
                    )}
                    {getAddressStatusLabel(address)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setClassifyingAddress(address);
                      setClassificationId(address.bairro_id ?? "");
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-operational/30 bg-operational/8 px-2 py-1 text-[10px] font-bold text-operational transition hover:bg-operational/15"
                  >
                    <Pencil className="h-3 w-3" />
                    {address.bairro_status === "confirmado" ? "Alterar bairro" : "Classificar"}
                  </button>
                </div>
                {address.ponto_referencia ? (
                  <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                    {address.ponto_referencia}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="flex min-h-52 flex-col items-center justify-center p-6 text-center">
            <House className="h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Nenhum endereço encontrado.</p>
          </div>
        )}
      </section>

      {formOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/90 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleSubmit}
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-operational/35 bg-card p-5 shadow-[0_0_50px_color-mix(in_oklab,var(--operational)_16%,transparent)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-operational">
                  Novo cadastro
                </p>
                <h2 className="mt-1 text-xl font-black">Adicionar endereço</h2>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Logradouro <span className="text-destructive">*</span>
                </span>
                <input
                  value={street}
                  onChange={(event) => setStreet(event.target.value)}
                  className={fieldClass}
                  required
                />
              </label>
              <label>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Número
                </span>
                <input
                  value={number}
                  onChange={(event) => setNumber(event.target.value)}
                  disabled={noNumber}
                  className={fieldClass}
                />
              </label>
              <label className="flex min-h-11 items-center gap-2 self-end rounded-lg border border-border bg-background px-3 text-sm">
                <input
                  type="checkbox"
                  checked={noNumber}
                  onChange={(event) => setNoNumber(event.target.checked)}
                  className="accent-[var(--operational)]"
                />{" "}
                Sem número
              </label>
              <label>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Complemento
                </span>
                <input
                  value={complement}
                  onChange={(event) => setComplement(event.target.value)}
                  className={fieldClass}
                />
              </label>
              <label>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Bairro territorial
                </span>
                <select
                  value={neighborhoodId}
                  onChange={(event) => setNeighborhoodId(event.target.value)}
                  className={fieldClass}
                >
                  <option value="">Deixar pendente</option>
                  {neighborhoods.map((bairro) => (
                    <option key={bairro.id} value={bairro.id}>
                      {bairro.nome}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  A seleção será registrada como confirmação humana.
                </span>
              </label>
              <label>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Município <span className="text-destructive">*</span>
                </span>
                <input
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  className={fieldClass}
                  required
                />
              </label>
              <label>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  UF <span className="text-destructive">*</span>
                </span>
                <input
                  maxLength={2}
                  value={uf}
                  onChange={(event) => setUf(event.target.value)}
                  className={fieldClass}
                  required
                />
              </label>
              <label>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  CEP
                </span>
                <input
                  value={cep}
                  onChange={(event) => setCep(event.target.value)}
                  className={fieldClass}
                />
              </label>
              <label>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Latitude
                </span>
                <input
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(event) => setLatitude(event.target.value)}
                  className={fieldClass}
                />
              </label>
              <label>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Longitude
                </span>
                <input
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(event) => setLongitude(event.target.value)}
                  className={fieldClass}
                />
              </label>
              <label className="sm:col-span-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Link do Google Maps
                </span>
                <div className="relative">
                  <Link2 className="pointer-events-none absolute left-3 top-1/2 mt-1 h-4 w-4 -translate-y-1/2 text-operational" />
                  <input
                    type="url"
                    value={mapsUrl}
                    onChange={(event) => setMapsUrl(event.target.value)}
                    placeholder="https://maps.google.com/..."
                    className={`${fieldClass} pl-10`}
                  />
                </div>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  Use quando a rua ainda não aparecer em serviços de busca.
                </span>
              </label>
              <label className="sm:col-span-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Ponto de referência
                </span>
                <input
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  className={fieldClass}
                />
              </label>
              <label className="sm:col-span-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Como chegar
                </span>
                <textarea
                  value={howToGetThere}
                  onChange={(event) => setHowToGetThere(event.target.value)}
                  rows={3}
                  placeholder="Explique do jeito que se fala: porteira azul à direita, 4 km depois do posto, terceira casa com pé de manga na frente."
                  className={`${fieldClass} min-h-24 resize-y leading-relaxed`}
                />
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  É o campo mais importante do cadastro — o que nenhum mapa tem. Também é por ele
                  que a busca encontra o local depois.
                </span>
              </label>
              <label className="sm:col-span-2 flex min-h-11 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  className="accent-[var(--operational)]"
                />{" "}
                Local já confirmado em campo
              </label>
              <label className="sm:col-span-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Observações
                </span>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className={`${fieldClass} py-3`}
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-operational px-4 text-sm font-black text-[var(--operational-contrast)] disabled:opacity-60"
            >
              <MapPin className="h-5 w-5" /> {saving ? "Salvando..." : "Cadastrar endereço"}
            </button>
          </form>
        </div>
      ) : null}

      {classifyingAddress ? (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-background/90 p-4 backdrop-blur-sm">
          <section className="w-full max-w-lg rounded-2xl border border-operational/35 bg-card p-5 shadow-[0_0_50px_color-mix(in_oklab,var(--operational)_16%,transparent)]">
            <header className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-operational">
                  Confirmação territorial
                </p>
                <h2 className="mt-1 text-xl font-black">Classificar endereço</h2>
                <p className="mt-2 text-xs text-muted-foreground">
                  {classifyingAddress.logradouro},{" "}
                  {classifyingAddress.sem_numero ? "s/n" : (classifyingAddress.numero ?? "s/n")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setClassifyingAddress(null);
                  setClassificationId("");
                }}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent"
                aria-label="Fechar classificação"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <label className="mt-5 block">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Bairro confirmado
              </span>
              <select
                value={classificationId}
                onChange={(event) => setClassificationId(event.target.value)}
                className={fieldClass}
              >
                <option value="">Selecione o bairro correto</option>
                {neighborhoods.map((bairro) => (
                  <option key={bairro.id} value={bairro.id}>
                    {bairro.nome}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-4 flex gap-3 rounded-xl border border-warning/25 bg-warning/5 p-3 text-xs leading-relaxed text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              Confirme somente depois de conferir o endereço, a referência ou o ponto no mapa. O
              sistema registrará a confirmação para auditoria.
            </div>

            <button
              type="button"
              onClick={() => void handleConfirmClassification()}
              disabled={!classificationId || classificationSaving}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-operational px-4 text-sm font-black text-[var(--operational-contrast)] disabled:opacity-50"
            >
              <ShieldCheck className="h-5 w-5" />
              {classificationSaving ? "Confirmando..." : "Confirmar bairro"}
            </button>
          </section>
        </div>
      ) : null}

      {deletingAddress ? (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-background/90 p-4 backdrop-blur-sm">
          <section className="w-full max-w-md rounded-2xl border border-destructive/35 bg-card p-5 shadow-[0_0_50px_color-mix(in_oklab,var(--destructive)_16%,transparent)]">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-black">Excluir endereço</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  <strong className="text-foreground">
                    {deletingAddress.logradouro},{" "}
                    {deletingAddress.sem_numero ? "s/n" : (deletingAddress.numero ?? "s/n")}
                  </strong>{" "}
                  vai sair das listas e do mapa. Pessoas vinculadas a este endereço ficam sem
                  endereço vinculado.
                </p>
              </div>
            </div>
            {deleteError ? (
              <div className="mt-4 rounded-xl border border-destructive/35 bg-destructive/10 p-3 text-xs font-semibold leading-relaxed text-destructive">
                {deleteError}
              </div>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingAddress(null)}
                disabled={deleting}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold transition hover:bg-accent disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteAddress()}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition hover:brightness-110 disabled:opacity-60"
              >
                {deleting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {deleting ? "Excluindo..." : "Excluir endereço"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {reviewOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/90 p-3 backdrop-blur-sm sm:p-5">
          <section className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-operational/35 bg-card shadow-[0_0_60px_color-mix(in_oklab,var(--operational)_18%,transparent)]">
            <header className="sticky top-0 z-10 border-b border-border bg-card/95 p-5 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-operational">
                    Revisão territorial guiada
                  </p>
                  <h2 className="mt-1 text-xl font-black sm:text-2xl">Classificar bairros</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Uma decisão por vez. Nenhum bairro é confirmado automaticamente.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReviewOpen(false)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent"
                  aria-label="Fechar revisão"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-operational transition-[width] duration-500"
                    style={{ width: `${reviewProgress}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {reviewProcessed} revisado(s) · {reviewTotal} restante(s)
                </span>
              </div>
            </header>

            {reviewLoading ? (
              <div className="flex min-h-96 flex-col items-center justify-center gap-3 p-8 text-sm text-muted-foreground">
                <LoaderCircle className="h-7 w-7 animate-spin text-operational" />
                Carregando fila limitada do servidor...
              </div>
            ) : reviewError && !reviewAddress ? (
              <div className="flex min-h-96 flex-col items-center justify-center p-8 text-center">
                <AlertTriangle className="h-8 w-8 text-destructive" />
                <p className="mt-3 max-w-md text-sm text-muted-foreground">{reviewError}</p>
                <button
                  type="button"
                  onClick={() => void openReviewQueue()}
                  className="mt-5 min-h-11 rounded-lg border border-operational/35 px-4 text-sm font-bold text-operational"
                >
                  Tentar novamente
                </button>
              </div>
            ) : reviewAddress ? (
              <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                <div className="overflow-hidden rounded-xl border border-border bg-background">
                  {reviewMapUrl ? (
                    <iframe
                      key={reviewAddress.id}
                      src={reviewMapUrl}
                      title={`Mapa de ${reviewAddress.logradouro}`}
                      className="h-72 w-full border-0 sm:h-[390px]"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-72 flex-col items-center justify-center bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--operational)_10%,transparent),transparent_65%)] p-8 text-center sm:h-[390px]">
                      <MapPin className="h-9 w-9 text-muted-foreground" />
                      <strong className="mt-3 text-sm">Ponto ainda sem coordenadas</strong>
                      <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                        Confira o logradouro, o bairro informado e a referência antes de decidir.
                      </p>
                    </div>
                  )}
                  {getExternalMapUrl(reviewAddress) ? (
                    <a
                      href={getExternalMapUrl(reviewAddress) ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-h-11 items-center justify-center gap-2 border-t border-border text-xs font-bold text-operational hover:bg-operational/8"
                    >
                      <ExternalLink className="h-4 w-4" /> Conferir no mapa completo
                    </a>
                  ) : null}
                </div>

                <div className="flex min-w-0 flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Endereço atual
                  </span>
                  <h3 className="mt-2 break-words text-xl font-black">
                    {reviewAddress.logradouro},{" "}
                    {reviewAddress.sem_numero ? "s/n" : (reviewAddress.numero ?? "s/n")}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {[reviewAddress.complemento, reviewAddress.municipio, reviewAddress.uf]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    <ReviewFact label="Bairro informado" value={reviewAddress.bairro} />
                    <ReviewFact label="CEP" value={reviewAddress.cep} />
                    <ReviewFact
                      label="Ponto de referência"
                      value={reviewAddress.ponto_referencia}
                      wide
                    />
                    <ReviewFact label="Como chegar" value={reviewAddress.como_chegar} wide />
                  </div>

                  <label className="mt-5 block">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Bairro territorial correto
                    </span>
                    <select
                      value={reviewNeighborhoodId}
                      onChange={(event) => setReviewNeighborhoodId(event.target.value)}
                      className={fieldClass}
                    >
                      <option value="">Selecione após conferir</option>
                      {neighborhoods.map((bairro) => (
                        <option key={bairro.id} value={bairro.id}>
                          {bairro.nome}
                        </option>
                      ))}
                    </select>
                  </label>

                  {reviewError ? (
                    <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                      {reviewError}
                    </p>
                  ) : null}

                  <div className="mt-auto grid gap-2 pt-5 sm:grid-cols-[auto_1fr] lg:grid-cols-1 xl:grid-cols-[auto_1fr]">
                    <button
                      type="button"
                      onClick={() => void finishReviewDecision("nao_identificado")}
                      disabled={reviewSaving}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-border px-4 text-xs font-bold text-muted-foreground transition hover:border-destructive/40 hover:text-destructive disabled:opacity-50"
                    >
                      <CircleOff className="h-4 w-4" /> Não identificado
                    </button>
                    <button
                      type="button"
                      onClick={() => void finishReviewDecision("confirmar")}
                      disabled={!reviewNeighborhoodId || reviewSaving}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-operational px-4 text-sm font-black text-[var(--operational-contrast)] disabled:opacity-50"
                    >
                      {reviewSaving ? (
                        <LoaderCircle className="h-5 w-5 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-5 w-5" />
                      )}
                      {reviewSaving ? "Salvando..." : "Confirmar e próximo"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-96 flex-col items-center justify-center p-8 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full border border-success/30 bg-success/10 text-success">
                  <CheckCircle2 className="h-8 w-8" />
                </span>
                <h3 className="mt-5 text-xl font-black">Fila territorial concluída</h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  Não há endereços aguardando classificação. Os totais oficiais dos bairros já
                  consideram todas as decisões confirmadas.
                </p>
                <button
                  type="button"
                  onClick={() => setReviewOpen(false)}
                  className="mt-5 min-h-11 rounded-lg bg-operational px-5 text-sm font-black text-[var(--operational-contrast)]"
                >
                  Concluir revisão
                </button>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}

function buildOsmPreviewUrl(address: EnderecoRecord) {
  if (address.latitude === null || address.longitude === null) return null;
  const delta = 0.004;
  const bbox = [
    address.longitude - delta,
    address.latitude - delta,
    address.longitude + delta,
    address.latitude + delta,
  ].join(",");
  const params = new URLSearchParams({
    bbox,
    layer: "mapnik",
    marker: `${address.latitude},${address.longitude}`,
  });
  return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`;
}

function getExternalMapUrl(address: EnderecoRecord) {
  if (address.maps_url) return address.maps_url;
  if (address.latitude === null || address.longitude === null) return null;
  return `https://www.openstreetmap.org/?mlat=${address.latitude}&mlon=${address.longitude}#map=18/${address.latitude}/${address.longitude}`;
}

function getAddressStatusClass(address: EnderecoRecord) {
  if (address.bairro_status === "confirmado") {
    return "border-success/35 bg-success/10 text-success";
  }
  if (address.bairro_status === "nao_identificado") {
    return "border-border bg-muted/40 text-muted-foreground";
  }
  return "border-warning/35 bg-warning/10 text-warning";
}

function getAddressStatusLabel(address: EnderecoRecord) {
  if (address.bairro_status === "confirmado") return "Bairro confirmado";
  if (address.bairro_status === "nao_identificado") return "Não identificado";
  return "Bairro pendente";
}

function ReviewFact({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string | null;
  wide?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border border-border bg-background p-3 ${wide ? "sm:col-span-2 lg:col-span-1 xl:col-span-2" : ""}`}
    >
      <span className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <strong className="mt-1 block break-words text-xs text-foreground">
        {value?.trim() || "Não informado"}
      </strong>
    </div>
  );
}

function TerritorySummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Building2;
  label: string;
  value: number;
  tone: "operational" | "warning" | "success" | "neutral";
}) {
  const toneClass = {
    operational: "border-operational/30 bg-operational/6 text-operational",
    warning: "border-warning/30 bg-warning/6 text-warning",
    success: "border-success/30 bg-success/6 text-success",
    neutral: "border-border bg-muted/20 text-muted-foreground",
  }[tone];

  return (
    <article className={`flex items-center gap-3 rounded-xl border p-4 ${toneClass}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-current/25 bg-background/50">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <strong className="block text-xl font-black text-foreground">{value}</strong>
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
    </article>
  );
}
