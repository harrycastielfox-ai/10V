import { Building2, LoaderCircle, Search, ShieldAlert, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { InquiryPersonFormValue } from "@/lib/operationalContracts";
import type {
  NexoInquiryOrganizationOption,
  NexoInquiryPersonOption,
} from "@/features/nexo/nexoTypes";
import {
  createNexoInquiryOrganizationSelectionPatch,
  getNexoVinculoStatusLabel,
} from "@/features/nexo/nexoInquiryAffiliation";

type AffiliationValue = Pick<
  InquiryPersonFormValue,
  | "nexoPessoaId"
  | "nexoOrganizacaoId"
  | "nexoVinculoId"
  | "faccaoNomeInformada"
  | "faccaoSiglaInformada"
  | "funcaoFaccaoInformada"
  | "faccaoFonteInformada"
>;

export function InquiryNexoAffiliationFields({
  value,
  onChange,
  canAccessNexo,
}: {
  value: AffiliationValue;
  onChange: (patch: Partial<InquiryPersonFormValue>) => void;
  canAccessNexo: boolean;
}) {
  const [organizations, setOrganizations] = useState<NexoInquiryOrganizationOption[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<NexoInquiryPersonOption | null>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<NexoInquiryPersonOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [manualMode, setManualMode] = useState(
    !value.nexoOrganizacaoId && Boolean(value.faccaoNomeInformada || value.faccaoSiglaInformada),
  );

  useEffect(() => {
    if (!canAccessNexo) return;
    let active = true;
    setLoading(true);
    void import("@/lib/repositories/nexoRepository")
      .then(async (repository) => {
        const [foundOrganizations, foundPeople] = await Promise.all([
          repository.listNexoInquiryOrganizations(),
          value.nexoPessoaId
            ? repository.getNexoInquiryPeopleByIds([value.nexoPessoaId])
            : Promise.resolve([]),
        ]);
        if (!active) return;
        setOrganizations(foundOrganizations);
        setSelectedPerson(foundPeople[0] ?? null);
        setSearch(foundPeople[0]?.nome ?? "");
        setError("");
      })
      .catch(() => {
        if (active)
          setError("Não foi possível consultar o NEXO. O cadastro manual continua disponível.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canAccessNexo, value.nexoPessoaId]);

  useEffect(() => {
    const term = search.trim();
    if (!canAccessNexo || term.length < 2 || selectedPerson?.nome === term) {
      setResults([]);
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      setSearching(true);
      void import("@/lib/repositories/nexoRepository")
        .then((repository) => repository.searchNexoInquiryPeople(term))
        .then((matches) => {
          if (active) {
            setResults(matches);
            setError("");
          }
        })
        .catch(() => {
          if (active) setError("A busca no NEXO está indisponível para este usuário.");
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [canAccessNexo, search, selectedPerson?.nome]);

  const selectedLink = selectedPerson?.vinculos.find((link) => link.id === value.nexoVinculoId);
  const hasAffiliationInformation = Boolean(
    value.nexoPessoaId ||
    value.nexoOrganizacaoId ||
    value.nexoVinculoId ||
    value.faccaoNomeInformada.trim() ||
    value.faccaoSiglaInformada.trim(),
  );
  const hasProtectedNexoReference = Boolean(
    value.nexoPessoaId || value.nexoOrganizacaoId || value.nexoVinculoId,
  );
  const hasFactionInformation = Boolean(
    value.nexoOrganizacaoId ||
    value.faccaoNomeInformada.trim() ||
    value.faccaoSiglaInformada.trim(),
  );
  const currentOrganization = organizations.find(
    (organization) => organization.id === value.nexoOrganizacaoId,
  );

  const resetAffiliation = () => {
    setSelectedPerson(null);
    setSearch("");
    setResults([]);
    setManualMode(false);
    onChange({
      nexoPessoaId: null,
      nexoOrganizacaoId: null,
      nexoVinculoId: null,
      faccaoNomeInformada: "",
      faccaoSiglaInformada: "",
      funcaoFaccaoInformada: "",
      faccaoFonteInformada: "",
    });
  };

  const selectOrganization = (id: string) => {
    if (id === "__manual__") {
      setManualMode(true);
      onChange({
        nexoOrganizacaoId: null,
        nexoVinculoId: null,
        faccaoNomeInformada: "",
        faccaoSiglaInformada: "",
        funcaoFaccaoInformada: "",
        faccaoFonteInformada: "",
      });
      return;
    }

    setManualMode(false);
    const organization = organizations.find((item) => item.id === id);
    const link = selectedPerson?.vinculos.find(
      (item) => item.organizacao_id === id && item.organizacao,
    );
    onChange(
      createNexoInquiryOrganizationSelectionPatch(organization?.id ?? null, link?.id ?? null),
    );
  };

  const selectPerson = (person: NexoInquiryPersonOption) => {
    setSelectedPerson(person);
    setSearch(person.nome);
    setResults([]);
    const link = value.nexoOrganizacaoId
      ? person.vinculos.find(
          (item) => item.organizacao_id === value.nexoOrganizacaoId && item.organizacao,
        )
      : undefined;
    onChange({
      nexoPessoaId: person.id,
      nexoVinculoId: link?.id ?? null,
      ...(link?.organizacao
        ? {
            nexoOrganizacaoId: link.organizacao.id,
            faccaoNomeInformada: "",
            faccaoSiglaInformada: "",
            funcaoFaccaoInformada: "",
            faccaoFonteInformada: "",
          }
        : {}),
    });
  };

  const selectLink = (linkId: string) => {
    const link = selectedPerson?.vinculos.find((item) => item.id === linkId);
    if (!selectedPerson || !link?.organizacao) {
      onChange({ nexoVinculoId: null });
      return;
    }
    onChange({
      nexoPessoaId: selectedPerson.id,
      nexoOrganizacaoId: link.organizacao_id,
      nexoVinculoId: link.id,
      faccaoNomeInformada: "",
      faccaoSiglaInformada: "",
      funcaoFaccaoInformada: "",
      faccaoFonteInformada: "",
    });
  };

  if (!canAccessNexo && hasProtectedNexoReference) {
    return (
      <div className="rounded-lg border border-border bg-background/45 px-3 py-2.5 text-xs text-muted-foreground">
        Uma referência NEXO já está associada. Os dados protegidos foram preservados e não são
        exibidos para o seu nível de acesso.
      </div>
    );
  }

  return (
    <section className="space-y-3 rounded-lg border border-border/75 bg-background/45 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-foreground">
            Vínculo com facção
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Associação opcional. A busca apenas sugere perfis; a confirmação é manual.
          </p>
        </div>
        {hasAffiliationInformation ? (
          <button
            type="button"
            onClick={resetAffiliation}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
            title="Remover vínculo informado"
            aria-label="Remover vínculo informado"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {!canAccessNexo ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              Facção informada neste procedimento
            </span>
            <input
              value={value.faccaoNomeInformada}
              onChange={(event) => onChange({ faccaoNomeInformada: event.target.value })}
              placeholder="Nome informado"
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              Sigla informada
            </span>
            <input
              value={value.faccaoSiglaInformada}
              onChange={(event) => onChange({ faccaoSiglaInformada: event.target.value })}
              placeholder="Opcional"
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              Função informada
            </span>
            <input
              value={value.funcaoFaccaoInformada}
              onChange={(event) => onChange({ funcaoFaccaoInformada: event.target.value })}
              placeholder="Opcional"
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              Fonte ou observação
            </span>
            <input
              value={value.faccaoFonteInformada}
              onChange={(event) => onChange({ faccaoFonteInformada: event.target.value })}
              placeholder="Opcional"
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <p className="sm:col-span-2 text-xs text-amber-700">
            Sem consulta ao perfil NEXO, esta informação será identificada como não confirmada.
          </p>
        </div>
      ) : (
        <>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              Facção cadastrada no NEXO
            </span>
            <select
              value={value.nexoOrganizacaoId ?? (manualMode ? "__manual__" : "")}
              onChange={(event) => selectOrganization(event.target.value)}
              disabled={loading}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary disabled:opacity-60"
            >
              <option value="">Não informado</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.sigla ? `${organization.sigla} · ` : ""}
                  {organization.nome}
                  {organization.status === "inativa" ? " · Inativa" : ""}
                </option>
              ))}
              <option value="__manual__">Outra / não cadastrada</option>
            </select>
          </label>

          {manualMode ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                  Facção informada no procedimento
                </span>
                <input
                  value={value.faccaoNomeInformada}
                  onChange={(event) => onChange({ faccaoNomeInformada: event.target.value })}
                  placeholder="Nome informado"
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                  Sigla informada
                </span>
                <input
                  value={value.faccaoSiglaInformada}
                  onChange={(event) => onChange({ faccaoSiglaInformada: event.target.value })}
                  placeholder="Opcional"
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </label>
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                Perfil da pessoa no NEXO
              </span>
              <span className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(event) => {
                    const next = event.target.value;
                    setSearch(next);
                    if (selectedPerson && next !== selectedPerson.nome) {
                      setSelectedPerson(null);
                      onChange({ nexoPessoaId: null, nexoVinculoId: null });
                    }
                  }}
                  placeholder="Digite o nome para buscar"
                  className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-9 text-sm outline-none focus:border-primary"
                />
                {searching || loading ? (
                  <LoaderCircle className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                ) : null}
              </span>
            </label>

            {results.length > 0 ? (
              <ul className="max-h-48 overflow-y-auto rounded-md border border-border bg-card">
                {results.map((person) => (
                  <li key={person.id} className="border-b border-border/50 last:border-0">
                    <button
                      type="button"
                      onClick={() => selectPerson(person)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-accent"
                    >
                      {person.foto_perfil_url ? (
                        <img
                          src={person.foto_perfil_url}
                          alt=""
                          className="size-9 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                          <UserRound className="size-4" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{person.nome}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {person.vinculos
                            .map((link) => {
                              const organization =
                                link.organizacao?.sigla || link.organizacao?.nome;
                              return organization
                                ? `${organization} (${getNexoVinculoStatusLabel(link.status)})`
                                : "";
                            })
                            .filter(Boolean)
                            .join(" · ") || "Sem vínculo de facção registrado"}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {search.trim().length >= 2 && !searching && !selectedPerson && results.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum perfil encontrado. A facção pode ficar registrada como informação não
                confirmada.
              </p>
            ) : null}
          </div>

          {selectedPerson ? (
            <div className="flex items-start gap-3 rounded-md border border-primary/25 bg-primary/[0.05] p-3">
              {selectedPerson.foto_perfil_url ? (
                <img
                  src={selectedPerson.foto_perfil_url}
                  alt=""
                  className="size-12 shrink-0 rounded-md object-cover"
                />
              ) : (
                <span className="grid size-12 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                  <UserRound className="size-5" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground">{selectedPerson.nome}</p>
                {selectedPerson.apelido ? (
                  <p className="truncate text-xs text-muted-foreground">{selectedPerson.apelido}</p>
                ) : null}
                {selectedPerson.cpf ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">CPF: {selectedPerson.cpf}</p>
                ) : null}
                <p className="mt-1 text-[11px] text-primary">Perfil NEXO selecionado manualmente</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedPerson(null);
                  setSearch("");
                  onChange({ nexoPessoaId: null, nexoVinculoId: null });
                }}
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent"
                aria-label="Desvincular perfil NEXO"
                title="Desvincular perfil NEXO"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : null}

          {selectedPerson && selectedPerson.vinculos.length > 0 ? (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                Vínculo registrado no NEXO
              </span>
              <select
                value={value.nexoVinculoId ?? ""}
                onChange={(event) => selectLink(event.target.value)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              >
                <option value="">Sem vínculo selecionado entre este perfil e a facção</option>
                {selectedPerson.vinculos.map((link) => (
                  <option key={link.id} value={link.id} disabled={link.status === "desvinculado"}>
                    {link.organizacao?.sigla ? `${link.organizacao.sigla} · ` : ""}
                    {link.organizacao?.nome ?? "Facção indisponível"} —{" "}
                    {getNexoVinculoStatusLabel(link.status)}
                  </option>
                ))}
              </select>
              {selectedLink ? (
                <span className="mt-1 block text-xs text-muted-foreground">
                  {selectedLink.funcao ? `Função: ${selectedLink.funcao}. ` : ""}
                  {selectedLink.fonte_resumo
                    ? `Fonte NEXO: ${selectedLink.fonte_resumo}`
                    : "Fonte não informada no NEXO."}
                </span>
              ) : null}
            </label>
          ) : null}

          {hasFactionInformation && !value.nexoVinculoId ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                  Função informada
                </span>
                <input
                  value={value.funcaoFaccaoInformada}
                  onChange={(event) => onChange({ funcaoFaccaoInformada: event.target.value })}
                  placeholder="Opcional"
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                  Fonte ou observação
                </span>
                <input
                  value={value.faccaoFonteInformada}
                  onChange={(event) => onChange({ faccaoFonteInformada: event.target.value })}
                  placeholder="Opcional"
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </label>
            </div>
          ) : null}

          {hasFactionInformation && !value.nexoVinculoId ? (
            <p className="flex items-start gap-2 text-xs text-amber-700">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />A facção está informada no
              procedimento, mas não há vínculo correspondente confirmado no perfil NEXO.
            </p>
          ) : null}

          {error ? (
            <p className="flex items-start gap-2 text-xs text-destructive">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          ) : null}
        </>
      )}

      {currentOrganization && value.nexoVinculoId && selectedLink ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Building2 className="size-3.5" />
          <span>
            {currentOrganization.sigla ? `${currentOrganization.sigla} · ` : ""}
            {currentOrganization.nome}
          </span>
          <span className="font-semibold text-primary">
            {getNexoVinculoStatusLabel(selectedLink.status)}
          </span>
        </div>
      ) : null}
    </section>
  );
}
