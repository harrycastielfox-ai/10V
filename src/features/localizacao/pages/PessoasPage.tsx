import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  House,
  Link2,
  MapPin,
  Navigation,
  Phone,
  Plus,
  Route,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  UserRoundSearch,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  createPessoaCadastroCompleto,
  getPessoaPhotoSignedUrl,
  listBairrosOperacionais,
  listEnderecos,
  listPessoas,
  updatePessoaCadastroCompleto,
} from "@/lib/repositories/localizacaoRepository";
import { MUNICIPIO_PADRAO, PESSOA_VINCULO_LABELS, UF_PADRAO } from "../localizacaoConstants";
import { parseCoordinateInput } from "../coordinateParser";
import { PessoaDetailsDialog } from "../components/PessoaDetailsDialog";
import type {
  BairroOperacionalRecord,
  EnderecoPayload,
  EnderecoRecord,
  PessoaAlvoRecord,
  PessoaDetalheRecord,
  PessoaTelefoneContato,
  PessoaVinculo,
} from "../localizacaoTypes";

const fieldClass =
  "mt-2 min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-operational/60 focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--operational)_10%,transparent)]";

function PersonAvatar({ person }: { person: PessoaAlvoRecord }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getPessoaPhotoSignedUrl(person.foto_perfil_path, "thumbnail").then((value) => {
      if (!cancelled) setUrl(value);
    });
    return () => {
      cancelled = true;
    };
  }, [person.foto_perfil_path]);
  return url ? (
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      className="h-12 w-12 shrink-0 rounded-xl object-cover"
    />
  ) : (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-operational/30 bg-operational/10 text-operational">
      <UserRoundSearch className="h-5 w-5" />
    </span>
  );
}

export default function PessoasPage() {
  const [searchInput, setSearchInput] = useState("");
  const [people, setPeople] = useState<PessoaAlvoRecord[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [editingOriginalAddressId, setEditingOriginalAddressId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [motherName, setMotherName] = useState("");
  const [link, setLink] = useState<PessoaVinculo>("alvo");
  const [phones, setPhones] = useState<PessoaTelefoneContato[]>([{ nome: "", numero: "" }]);
  const [boNumber, setBoNumber] = useState("");
  const [procedureNumber, setProcedureNumber] = useState("");
  const [notes, setNotes] = useState("");

  const [addressMode, setAddressMode] = useState<"existing" | "manual">("existing");
  const [addressSearch, setAddressSearch] = useState("");
  const [addresses, setAddresses] = useState<EnderecoRecord[]>([]);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [noNumber, setNoNumber] = useState(false);
  const [complement, setComplement] = useState("");
  const [neighborhoodId, setNeighborhoodId] = useState("");
  const [neighborhoods, setNeighborhoods] = useState<BairroOperacionalRecord[]>([]);
  const [city, setCity] = useState(MUNICIPIO_PADRAO);
  const [uf, setUf] = useState(UF_PADRAO);
  const [cep, setCep] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [reference, setReference] = useState("");
  const [howToGetThere, setHowToGetThere] = useState("");
  const [saveRoute, setSaveRoute] = useState(true);

  const photoPreview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(
    () => () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    },
    [photoPreview],
  );

  useEffect(() => {
    let cancelled = false;
    void listBairrosOperacionais()
      .then((records) => {
        if (!cancelled) setNeighborhoods(records);
      })
      .catch((error) => {
        console.error("[PessoasPage] Falha ao carregar bairros", error);
        if (!cancelled) setFormError("Não foi possível carregar o catálogo de bairros.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void listPessoas(searchInput).then((records) => {
        if (!cancelled) setPeople(records);
      });
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchInput]);

  useEffect(() => {
    if (!formOpen || step !== 2 || addressMode !== "existing") return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void listEnderecos(addressSearch).then((records) => {
        if (!cancelled) setAddresses(records);
      });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [addressMode, addressSearch, formOpen, step]);

  function resetForm() {
    setEditingOriginalAddressId(null);
    setStep(1);
    setPhoto(null);
    setName("");
    setNickname("");
    setCpf("");
    setRg("");
    setBirthDate("");
    setMotherName("");
    setLink("alvo");
    setPhones([{ nome: "", numero: "" }]);
    setBoNumber("");
    setProcedureNumber("");
    setNotes("");
    setAddressMode("existing");
    setAddressSearch("");
    setAddressId(null);
    setStreet("");
    setNumber("");
    setNoNumber(false);
    setComplement("");
    setNeighborhoodId("");
    setCity(MUNICIPIO_PADRAO);
    setUf(UF_PADRAO);
    setCep("");
    setLatitude("");
    setLongitude("");
    setMapsUrl("");
    setReference("");
    setHowToGetThere("");
    setSaveRoute(true);
  }

  function openForm() {
    setEditingPersonId(null);
    resetForm();
    setMessage(null);
    setFormError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingPersonId(null);
    setFormError(null);
  }

  function openEditForm(person: PessoaDetalheRecord) {
    resetForm();
    setEditingPersonId(person.id);
    setEditingOriginalAddressId(person.endereco_id);
    setName(person.nome);
    setNickname(person.apelido ?? "");
    setCpf(person.cpf ?? "");
    setRg(person.rg ?? "");
    setBirthDate(person.data_nascimento ?? "");
    setMotherName(person.nome_mae ?? "");
    setLink(person.vinculo);
    setPhones(
      person.telefones.length ? person.telefones : [{ nome: "", numero: person.telefone ?? "" }],
    );
    setBoNumber(person.numero_bo ?? "");
    setProcedureNumber(person.numero_procedimento ?? "");
    setNotes(person.observacoes ?? "");
    setSaveRoute(false);

    if (person.endereco) {
      setAddressMode("manual");
      setAddressId(null);
      setStreet(person.endereco.logradouro);
      setNumber(person.endereco.numero ?? "");
      setNoNumber(person.endereco.sem_numero);
      setComplement(person.endereco.complemento ?? "");
      setNeighborhoodId(person.endereco.bairro_id ?? "");
      setCity(person.endereco.municipio);
      setUf(person.endereco.uf);
      setCep(person.endereco.cep ?? "");
      setLatitude(person.endereco.latitude?.toString() ?? "");
      setLongitude(person.endereco.longitude?.toString() ?? "");
      setMapsUrl(person.endereco.maps_url ?? "");
      setReference(person.endereco.ponto_referencia ?? "");
      setHowToGetThere(person.endereco.como_chegar ?? "");
    }

    setStep(1);
    setMessage(null);
    setFormError(null);
    setSelectedPersonId(null);
    setFormOpen(true);
  }

  function updatePhone(index: number, field: "nome" | "numero", value: string) {
    setPhones((current) =>
      current.map((contato, i) => (i === index ? { ...contato, [field]: value } : contato)),
    );
  }

  function addPhone() {
    setPhones((current) => [...current, { nome: "", numero: "" }]);
  }

  function removePhone(index: number) {
    setPhones((current) =>
      current.length > 1 ? current.filter((_, i) => i !== index) : [{ nome: "", numero: "" }],
    );
  }

  function goToAddressStep() {
    if (!name.trim()) {
      setFormError("Informe o nome para continuar.");
      return;
    }
    setFormError(null);
    // Mantém explicitamente o formulário aberto durante a troca de etapa.
    // Isso também protege o fluxo de edição contra submissões acidentais.
    setFormOpen(true);
    setStep(2);
  }

  function manualAddress(): EnderecoPayload | null {
    if (addressMode !== "manual") return null;
    const lat = parseCoordinateInput(latitude, "latitude");
    const lng = parseCoordinateInput(longitude, "longitude");
    if (!street.trim()) throw new Error("Informe o logradouro manual.");
    if ((lat === null) !== (lng === null)) {
      throw new Error("Preencha latitude e longitude juntas, ou deixe as duas vazias.");
    }
    if (mapsUrl.trim() && !/^https?:\/\//i.test(mapsUrl.trim())) {
      throw new Error("O link do mapa deve começar com http:// ou https://.");
    }
    const selectedNeighborhood = neighborhoods.find((item) => item.id === neighborhoodId) ?? null;
    return {
      logradouro: street.trim(),
      numero: noNumber ? null : number.trim() || null,
      sem_numero: noNumber,
      complemento: complement.trim() || null,
      bairro: selectedNeighborhood?.nome ?? null,
      bairro_id: selectedNeighborhood?.id ?? null,
      bairro_status: selectedNeighborhood ? "confirmado" : "pendente",
      municipio: city.trim() || MUNICIPIO_PADRAO,
      uf: (uf.trim() || UF_PADRAO).toUpperCase(),
      cep: cep.trim() || null,
      ponto_referencia: reference.trim() || null,
      como_chegar: howToGetThere.trim() || null,
      latitude: lat,
      longitude: lng,
      maps_url: mapsUrl.trim() || null,
      confirmado: false,
      observacoes: null,
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 1) {
      goToAddressStep();
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const selectedAddressId = addressId ?? editingOriginalAddressId;
      if (addressMode === "existing" && !selectedAddressId) {
        throw new Error("Selecione um endereço ou cadastre manualmente.");
      }
      const payload = {
        pessoa: {
          nome: name.trim(),
          apelido: nickname.trim() || null,
          cpf: cpf.trim() || null,
          rg: rg.trim() || null,
          data_nascimento: birthDate || null,
          nome_mae: motherName.trim() || null,
          vinculo: link,
          telefones: phones
            .map((contato) => ({ nome: contato.nome.trim(), numero: contato.numero.trim() }))
            .filter((contato) => contato.numero)
            .map((contato) => ({ nome: contato.nome || "Principal", numero: contato.numero })),
          numero_bo: boNumber.trim() || null,
          numero_procedimento: procedureNumber.trim() || null,
          inquerito_id: null,
          observacoes: notes.trim() || null,
        },
        endereco: manualAddress(),
        endereco_id: addressMode === "existing" ? selectedAddressId : null,
        foto: photo,
        salvar_rota: saveRoute,
      };
      const result = editingPersonId
        ? await updatePessoaCadastroCompleto(editingPersonId, payload)
        : await createPessoaCadastroCompleto(payload);
      setPeople(await listPessoas(searchInput));
      setFormOpen(false);
      const warnings = [
        !result.foto_ok ? "A foto não pôde ser anexada." : "",
        !result.rota_ok ? "A rota não pôde ser salva." : "",
      ].filter(Boolean);
      setMessage(
        warnings.length
          ? `${editingPersonId ? "Cadastro atualizado" : "Pessoa cadastrada"}. ${warnings.join(" ")}`
          : editingPersonId
            ? "Cadastro e endereço atualizados com sucesso."
            : "Pessoa, endereço e rota cadastrados com sucesso.",
      );
      setEditingPersonId(null);
      resetForm();
    } catch (error) {
      console.error("[PessoasPage] Falha ao criar cadastro", error);
      const errorMessage = error instanceof Error ? error.message : "";
      setFormError(
        errorMessage.includes("localizacao_enderecos_latitude_check")
          ? "A latitude informada é inválida. Para Itabela, use um valor próximo de -16.57."
          : errorMessage.includes("localizacao_enderecos_longitude_check")
            ? "A longitude informada é inválida. Para Itabela, use um valor próximo de -39.48."
            : errorMessage ||
              "Não foi possível concluir o cadastro. Revise os dados e tente novamente.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-operational">
            Cadastros operacionais
          </p>
          <h1 className="mt-1 text-2xl font-black sm:text-3xl">Pessoas / Alvos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Perfil, fotografia, telefone, procedimento e localização em um só cadastro.
          </p>
        </div>
        <button
          type="button"
          onClick={openForm}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-operational px-4 py-2.5 text-sm font-bold text-[var(--operational-contrast)] transition hover:-translate-y-0.5 hover:shadow-[0_0_22px_color-mix(in_oklab,var(--operational)_28%,transparent)]"
        >
          <Plus className="h-4 w-4" /> Adicionar pessoa
        </button>
      </header>

      {message ? (
        <div
          role="status"
          className="mb-4 rounded-lg border border-operational/35 bg-operational/10 p-3 text-sm"
        >
          {message}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border p-4">
          <label className="flex min-h-11 max-w-2xl items-center gap-2 rounded-lg border border-border bg-background px-3 transition focus-within:border-operational/50">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Buscar por nome, apelido, telefone, B.O. ou procedimento"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
        </div>
        {people.length ? (
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {people.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => setSelectedPersonId(person.id)}
                aria-label={`Abrir ficha de ${person.nome}`}
                data-testid={`pessoa-card-${person.id}`}
                className="group rounded-xl border border-border bg-background p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-operational/35 hover:shadow-[0_12px_34px_rgba(0,0,0,.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-operational"
              >
                <div className="flex items-start gap-3">
                  <PersonAvatar person={person} />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-black">{person.nome}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {PESSOA_VINCULO_LABELS[person.vinculo]}
                      {person.apelido ? ` · ${person.apelido}` : ""}
                    </p>
                  </div>
                </div>
                <dl className="mt-4 grid gap-2 text-xs">
                  <div className="flex justify-between gap-3 border-t border-border pt-2">
                    <dt className="text-muted-foreground">Telefone</dt>
                    <dd className="text-right font-semibold">
                      {person.telefone ?? "Não informado"}
                      {person.telefones.length > 1 ? (
                        <span className="ml-1 text-operational">
                          +{person.telefones.length - 1}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-border pt-2">
                    <dt className="text-muted-foreground">B.O.</dt>
                    <dd className="text-right font-semibold text-operational">
                      {person.numero_bo ?? "Não informado"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-border pt-2">
                    <dt className="text-muted-foreground">Procedimento</dt>
                    <dd className="text-right font-semibold">
                      {person.numero_procedimento ?? "Não informado"}
                    </dd>
                  </div>
                </dl>
                <span className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[10px] font-black uppercase tracking-wider text-operational">
                  Abrir ficha completa
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex min-h-52 flex-col items-center justify-center p-6 text-center">
            <UserRoundSearch className="h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Nenhuma pessoa encontrada.</p>
          </div>
        )}
      </section>

      {selectedPersonId ? (
        <PessoaDetailsDialog
          personId={selectedPersonId}
          onClose={() => setSelectedPersonId(null)}
          onEdit={openEditForm}
          onDeleted={(personId) => {
            setPeople((current) => current.filter((person) => person.id !== personId));
            setMessage("Contato excluído.");
          }}
        />
      ) : null}

      {formOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleSubmit}
            noValidate
            aria-busy={saving}
            className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-operational/35 bg-card p-5 shadow-[0_0_60px_color-mix(in_oklab,var(--operational)_18%,transparent)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="group relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-operational/60 bg-operational/10 text-operational shadow-[0_0_22px_color-mix(in_oklab,var(--operational)_30%,transparent)] transition hover:scale-105 hover:bg-operational/20"
                  aria-label="Anexar fotografia da pessoa"
                >
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Prévia da fotografia"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Camera className="h-6 w-6" />
                  )}
                  <span className="absolute inset-0 animate-pulse rounded-xl border border-operational/30" />
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
                />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-operational">
                    {editingPersonId ? "Atualização de cadastro" : "Novo cadastro"}
                  </p>
                  <h2 className="mt-1 text-xl font-black">
                    {editingPersonId ? "Editar pessoa / alvo" : "Adicionar pessoa / alvo"}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Clique no ícone azul para anexar a fotografia.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-accent"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative mt-6 grid grid-cols-2 gap-3">
              <span className="absolute left-[25%] right-[25%] top-5 h-px bg-border" />
              {[
                { number: 1, title: "Perfil da pessoa", icon: UserRoundSearch },
                { number: 2, title: "Endereço e rota", icon: MapPin },
              ].map(({ number: itemStep, title, icon: Icon }) => {
                const active = step === itemStep;
                const done = step > itemStep;
                return (
                  <div
                    key={itemStep}
                    className="relative z-10 flex flex-col items-center gap-2 text-center"
                  >
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${active || done ? "border-operational bg-operational text-[var(--operational-contrast)] shadow-[0_0_18px_color-mix(in_oklab,var(--operational)_30%,transparent)]" : "border-border bg-card text-muted-foreground"}`}
                    >
                      {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </span>
                    <strong
                      className={`text-[10px] uppercase tracking-wider ${active ? "text-operational" : "text-muted-foreground"}`}
                    >
                      Etapa {itemStep} · {title}
                    </strong>
                  </div>
                );
              })}
            </div>

            {step === 1 ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label="Nome" required>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={fieldClass}
                    required
                  />
                </Field>
                <Field label="Apelido">
                  <input
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className={fieldClass}
                  />
                </Field>
                <Field label="Vínculo">
                  <select
                    value={link}
                    onChange={(e) => setLink(e.target.value as PessoaVinculo)}
                    className={fieldClass}
                  >
                    {Object.entries(PESSOA_VINCULO_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Telefones" wide>
                  <div className="mt-2 space-y-2">
                    {phones.map((contato, index) => (
                      <div key={index} className="flex flex-col gap-2 sm:flex-row">
                        <input
                          value={contato.nome}
                          onChange={(e) => updatePhone(index, "nome", e.target.value)}
                          placeholder="Nome do contato (ex.: Gerente, Portaria)"
                          className={`${fieldClass} mt-0 sm:w-[55%]`}
                        />
                        <div className="flex flex-1 gap-2">
                          <input
                            value={contato.numero}
                            onChange={(e) => updatePhone(index, "numero", e.target.value)}
                            placeholder="Telefone"
                            className={`${fieldClass} mt-0 flex-1`}
                          />
                          <button
                            type="button"
                            onClick={() => removePhone(index)}
                            aria-label="Remover este telefone"
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:border-destructive/40 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addPhone}
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-operational/35 bg-operational/10 px-3 text-xs font-bold text-operational transition hover:bg-operational/20"
                    >
                      <Phone className="h-3.5 w-3.5" /> Adicionar telefone
                    </button>
                  </div>
                </Field>
                <Field label="Nº do B.O.">
                  <input
                    value={boNumber}
                    onChange={(e) => setBoNumber(e.target.value)}
                    className={fieldClass}
                    placeholder="Ex.: 00012345/2026"
                  />
                </Field>
                <Field label="Nº do procedimento">
                  <input
                    value={procedureNumber}
                    onChange={(e) => setProcedureNumber(e.target.value)}
                    className={fieldClass}
                    placeholder="IP, TCO, APF ou outro"
                  />
                </Field>
                <Field label="CPF">
                  <input
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    className={fieldClass}
                  />
                </Field>
                <Field label="RG">
                  <input
                    value={rg}
                    onChange={(e) => setRg(e.target.value)}
                    className={fieldClass}
                  />
                </Field>
                <Field label="Nascimento">
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className={fieldClass}
                  />
                </Field>
                <Field label="Nome da mãe">
                  <input
                    value={motherName}
                    onChange={(e) => setMotherName(e.target.value)}
                    className={fieldClass}
                  />
                </Field>
                <Field label="Observações" wide>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className={`${fieldClass} py-3`}
                  />
                </Field>
              </div>
            ) : (
              <div className="mt-6">
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-background p-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setAddressMode("existing");
                      setFormError(null);
                    }}
                    className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-xs font-bold transition ${addressMode === "existing" ? "bg-operational text-[var(--operational-contrast)]" : "text-muted-foreground hover:bg-accent"}`}
                  >
                    <Search className="h-4 w-4" /> Endereço existente
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddressMode("manual");
                      setAddressId(null);
                      setFormError(null);
                    }}
                    className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-xs font-bold transition ${addressMode === "manual" ? "bg-operational text-[var(--operational-contrast)]" : "text-muted-foreground hover:bg-accent"}`}
                  >
                    <House className="h-4 w-4" /> Cadastrar manualmente
                  </button>
                </div>

                {addressMode === "existing" ? (
                  <div className="mt-4 overflow-hidden rounded-xl border border-border bg-background">
                    <label className="flex min-h-12 items-center gap-2 border-b border-border px-4">
                      <Search className="h-4 w-4 text-muted-foreground" />
                      <input
                        value={addressSearch}
                        onChange={(e) => setAddressSearch(e.target.value)}
                        placeholder="Buscar rua, bairro ou referência"
                        className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                      />
                    </label>
                    <div className="max-h-60 overflow-y-auto p-2">
                      {addresses.length ? (
                        addresses.map((address) => (
                          <button
                            key={address.id}
                            type="button"
                            onClick={() => setAddressId(address.id)}
                            className={`flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition ${addressId === address.id ? "border-operational/55 bg-operational/10" : "border-transparent hover:bg-accent"}`}
                          >
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-operational" />
                            <span className="min-w-0">
                              <strong className="block text-sm">
                                {address.logradouro},{" "}
                                {address.sem_numero ? "s/n" : (address.numero ?? "s/n")}
                              </strong>
                              <small className="text-muted-foreground">
                                {[address.bairro, address.municipio, address.uf]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </small>
                            </span>
                            {addressId === address.id ? (
                              <Check className="ml-auto h-4 w-4 text-operational" />
                            ) : null}
                          </button>
                        ))
                      ) : (
                        <div className="p-5 text-center">
                          <p className="text-sm text-muted-foreground">
                            Nenhum endereço encontrado.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setAddressMode("manual");
                              setStreet(addressSearch);
                            }}
                            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-operational/40 bg-operational/10 px-3 py-2 text-xs font-bold text-operational"
                          >
                            <Plus className="h-4 w-4" /> Cadastrar este endereço manualmente
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label="Logradouro" required wide>
                      <input
                        value={street}
                        onChange={(e) => setStreet(e.target.value)}
                        className={fieldClass}
                        placeholder="Digite como o endereço é conhecido"
                        required
                      />
                    </Field>
                    <Field label="Número">
                      <input
                        value={number}
                        onChange={(e) => setNumber(e.target.value)}
                        disabled={noNumber}
                        className={fieldClass}
                      />
                    </Field>
                    <label className="mt-6 flex min-h-11 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm">
                      <input
                        type="checkbox"
                        checked={noNumber}
                        onChange={(e) => setNoNumber(e.target.checked)}
                        className="accent-[var(--operational)]"
                      />{" "}
                      Sem número
                    </label>
                    <Field label="Complemento">
                      <input
                        value={complement}
                        onChange={(e) => setComplement(e.target.value)}
                        className={fieldClass}
                      />
                    </Field>
                    <Field label="Bairro territorial">
                      <select
                        value={neighborhoodId}
                        onChange={(e) => setNeighborhoodId(e.target.value)}
                        className={fieldClass}
                      >
                        <option value="">Deixar pendente</option>
                        {neighborhoods.map((bairro) => (
                          <option key={bairro.id} value={bairro.id}>
                            {bairro.nome}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Município">
                      <input
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className={fieldClass}
                      />
                    </Field>
                    <Field label="UF">
                      <input
                        maxLength={2}
                        value={uf}
                        onChange={(e) => setUf(e.target.value)}
                        className={fieldClass}
                      />
                    </Field>
                    <Field label="CEP">
                      <input
                        value={cep}
                        onChange={(e) => setCep(e.target.value)}
                        className={fieldClass}
                      />
                    </Field>
                    <Field label="Latitude">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={latitude}
                        onChange={(e) => setLatitude(e.target.value)}
                        className={fieldClass}
                        placeholder="-16.000000"
                      />
                    </Field>
                    <Field label="Longitude">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={longitude}
                        onChange={(e) => setLongitude(e.target.value)}
                        className={fieldClass}
                        placeholder="-39.000000"
                      />
                    </Field>
                    <Field label="Link do Google Maps" wide>
                      <div className="relative">
                        <Link2 className="pointer-events-none absolute left-3 top-1/2 mt-1 h-4 w-4 -translate-y-1/2 text-operational" />
                        <input
                          type="url"
                          value={mapsUrl}
                          onChange={(e) => setMapsUrl(e.target.value)}
                          className={`${fieldClass} pl-10`}
                          placeholder="https://maps.google.com/..."
                        />
                      </div>
                    </Field>
                    <Field label="Ponto de referência" wide>
                      <input
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        className={fieldClass}
                      />
                    </Field>
                    <Field label="Como chegar" wide>
                      <textarea
                        rows={3}
                        value={howToGetThere}
                        onChange={(e) => setHowToGetThere(e.target.value)}
                        className={`${fieldClass} py-3`}
                        placeholder="Porteira azul à direita, depois do posto, terceira casa..."
                      />
                    </Field>
                  </div>
                )}

                <label className="mt-4 flex items-start gap-3 rounded-xl border border-operational/25 bg-operational/5 p-4">
                  <input
                    type="checkbox"
                    checked={saveRoute}
                    onChange={(e) => setSaveRoute(e.target.checked)}
                    className="mt-0.5 accent-[var(--operational)]"
                  />
                  <Route className="h-5 w-5 shrink-0 text-operational" />
                  <span>
                    <strong className="block text-sm">Salvar rota da delegacia até o local</strong>
                    <small className="mt-1 block text-xs text-muted-foreground">
                      O sistema guardará atalhos para Google Maps e Waze. A localização atual do
                      aparelho poderá ser usada ao navegar.
                    </small>
                  </span>
                </label>
              </div>
            )}

            {formError ? (
              <div
                role="alert"
                className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm font-semibold text-destructive"
              >
                {formError}
              </div>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
              {step === 2 ? (
                <button
                  type="button"
                  onClick={() => {
                    setFormError(null);
                    setStep(1);
                  }}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-bold transition hover:bg-accent"
                >
                  <ArrowLeft className="h-4 w-4" /> Voltar
                </button>
              ) : null}
              {step === 1 ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    goToAddressStep();
                  }}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-operational px-5 text-sm font-black text-[var(--operational-contrast)]"
                >
                  <Navigation className="h-4 w-4" /> Continuar para endereço{" "}
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-operational px-5 text-sm font-black text-[var(--operational-contrast)] disabled:opacity-60"
                >
                  <ShieldCheck className="h-5 w-5" />{" "}
                  {saving
                    ? "Salvando com segurança..."
                    : editingPersonId
                      ? "Salvar alterações"
                      : "Concluir cadastro"}
                </button>
              )}
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  required = false,
  wide = false,
  children,
}: {
  label: string;
  required?: boolean;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={wide ? "sm:col-span-2" : ""}>
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      {children}
    </label>
  );
}
