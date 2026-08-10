import {
  AlertCircle,
  CalendarDays,
  FileBadge,
  Fingerprint,
  LoaderCircle,
  MapPin,
  Pencil,
  Phone,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AbrirNoMapa } from "@/components/AbrirNoMapa";
import {
  getPessoaDetalhes,
  getPessoaPhotoSignedUrl,
  softDeletePessoa,
} from "@/lib/repositories/localizacaoRepository";
import { PESSOA_VINCULO_LABELS } from "../localizacaoConstants";
import type { EnderecoRecord, PessoaDetalheRecord } from "../localizacaoTypes";

interface PessoaDetailsDialogProps {
  personId: string;
  onClose: () => void;
  onEdit: (person: PessoaDetalheRecord) => void;
  onDeleted?: (personId: string) => void;
}

function present(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function formatDate(value: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatAddress(address: EnderecoRecord) {
  const number = address.sem_numero ? "s/n" : (present(address.numero) ?? "s/n");
  return `${address.logradouro}, ${number}`;
}

function DetailItem({ label, value }: { label: string; value: string | null | undefined }) {
  const normalized = present(value);
  if (!normalized) return null;

  return (
    <div className="border-t border-border py-3 first:border-t-0 first:pt-0">
      <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-semibold text-foreground">{normalized}</dd>
    </div>
  );
}

function ProfilePhoto({ person }: { person: PessoaDetalheRecord }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getPessoaPhotoSignedUrl(person.foto_perfil_path).then((value) => {
      if (!cancelled) setUrl(value);
    });
    return () => {
      cancelled = true;
    };
  }, [person.foto_perfil_path]);

  return url ? (
    <img
      src={url}
      alt={`Fotografia de ${person.nome}`}
      decoding="async"
      className="h-16 w-16 shrink-0 rounded-xl border border-operational/30 object-cover"
    />
  ) : (
    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-operational/30 bg-operational/10 text-operational">
      <UserRound className="h-7 w-7" />
    </span>
  );
}

export function PessoaDetailsDialog({
  personId,
  onClose,
  onEdit,
  onDeleted,
}: PessoaDetailsDialogProps) {
  const [person, setPerson] = useState<PessoaDetalheRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPerson(null);

    void getPessoaDetalhes(personId)
      .then((record) => {
        if (cancelled) return;
        if (!record) {
          setError("O cadastro não foi encontrado ou você não possui acesso a ele.");
          return;
        }
        setPerson(record);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        console.error("[PessoaDetailsDialog] Falha ao carregar ficha", reason);
        setError("Não foi possível carregar os dados completos desta pessoa.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [personId]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const mapTarget = useMemo(() => {
    const address = person?.endereco;
    if (!address) return null;
    return {
      endereco: formatAddress(address),
      latitude: address.latitude,
      longitude: address.longitude,
      cidade: `${address.municipio}, ${address.uf}`,
    };
  }, [person]);

  async function handleDeletePerson() {
    if (!person) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await softDeletePessoa(person.id);
      onDeleted?.(person.id);
      onClose();
    } catch (reason) {
      console.error("[PessoaDetailsDialog] Falha ao excluir contato", reason);
      setDeleteError(
        reason instanceof Error ? reason.message : "Não foi possível excluir este contato.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      // Sem blur e com fundo mais claro de propósito: isso abre em cima do
      // mapa, e o mapa precisa continuar visível e legível atrás da ficha —
      // não é um modal que trava a tela toda. z-index acima de 1000: os
      // controles internos do MapaCanvas (badge de bairros, painel
      // territorial, pill de rota) usam z-[900]/z-[1000] e furavam por cima
      // da ficha antes desse ajuste.
      className="animate-in fade-in fixed inset-0 z-[1100] flex items-stretch justify-end bg-black/35 duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pessoa-detalhe-titulo"
      data-testid="pessoa-detalhe-dialog"
    >
      <section className="animate-in slide-in-from-right-8 flex h-full w-full max-w-[560px] flex-col overflow-hidden border-l border-operational/25 bg-card shadow-[-24px_0_80px_rgba(0,0,0,.55)] duration-200">
        <header className="flex items-start justify-between gap-4 border-b border-border p-4 sm:px-5 sm:py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-operational">
              Ficha operacional
            </p>
            <h2 id="pessoa-detalhe-titulo" className="mt-1 text-xl font-black">
              Dados da pessoa
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Informações carregadas somente após a seleção do cadastro.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {person ? (
              <button
                type="button"
                onClick={() => onEdit(person)}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-operational/35 bg-operational/10 px-3 text-xs font-black text-operational transition hover:bg-operational/20"
              >
                <Pencil className="h-4 w-4" />
                <span className="hidden sm:inline">Editar cadastro</span>
                <span className="sm:hidden">Editar</span>
              </button>
            ) : null}
            {person ? (
              <button
                type="button"
                onClick={() => {
                  setDeleteError("");
                  setDeleteOpen(true);
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-destructive/35 bg-destructive/10 text-destructive transition hover:bg-destructive/20"
                aria-label="Excluir contato"
                title="Excluir contato"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-operational/40 hover:bg-accent hover:text-foreground"
              aria-label="Fechar ficha da pessoa"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {loading ? (
            <div className="flex min-h-64 flex-col items-center justify-center text-center">
              <LoaderCircle className="h-8 w-8 animate-spin text-operational" />
              <p className="mt-3 text-sm font-semibold">Carregando ficha completa...</p>
            </div>
          ) : error ? (
            <div className="flex min-h-64 flex-col items-center justify-center text-center">
              <AlertCircle className="h-9 w-9 text-destructive" />
              <p className="mt-3 max-w-sm text-sm font-semibold">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 rounded-lg border border-border px-4 py-2 text-xs font-bold transition hover:bg-accent"
              >
                Fechar
              </button>
            </div>
          ) : person ? (
            <div className="space-y-3">
              <section className="rounded-xl border border-operational/30 bg-operational/5 p-4">
                <div className="flex items-start gap-4">
                  <ProfilePhoto person={person} />
                  <div className="min-w-0 flex-1">
                    <span className="inline-flex rounded-full border border-operational/35 bg-operational/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-operational">
                      {PESSOA_VINCULO_LABELS[person.vinculo]}
                    </span>
                    <h3 className="mt-2 break-words text-lg font-black">{person.nome}</h3>
                    {present(person.apelido) ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Conhecido como {person.apelido}
                      </p>
                    ) : null}
                  </div>
                </div>
              </section>

              <div className="grid gap-3 md:grid-cols-2">
                <section className="rounded-xl border border-border bg-background p-4">
                  <div className="mb-3 flex items-center gap-2 text-operational">
                    <Fingerprint className="h-4 w-4" />
                    <h3 className="text-xs font-black uppercase tracking-wider">Identificação</h3>
                  </div>
                  <dl>
                    <DetailItem label="CPF" value={person.cpf} />
                    <DetailItem label="RG" value={person.rg} />
                    <DetailItem label="Nascimento" value={formatDate(person.data_nascimento)} />
                    <DetailItem label="Nome da mãe" value={person.nome_mae} />
                    {!person.cpf && !person.rg && !person.data_nascimento && !person.nome_mae ? (
                      <p className="text-xs text-muted-foreground">
                        Nenhuma identificação complementar informada.
                      </p>
                    ) : null}
                  </dl>
                </section>

                <section className="rounded-xl border border-border bg-background p-4">
                  <div className="mb-3 flex items-center gap-2 text-operational">
                    <FileBadge className="h-4 w-4" />
                    <h3 className="text-xs font-black uppercase tracking-wider">
                      Contato e vínculo
                    </h3>
                  </div>
                  <dl>
                    {person.telefones.length ? (
                      <div className="border-t border-border py-3 first:border-t-0 first:pt-0">
                        <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                          {person.telefones.length > 1 ? "Telefones" : "Telefone"}
                        </dt>
                        <dd className="mt-1.5 space-y-1.5">
                          {person.telefones.map((contato, index) => (
                            <span key={index} className="flex items-center gap-2 text-sm">
                              <Phone className="h-3.5 w-3.5 shrink-0 text-operational" />
                              <strong className="font-semibold">{contato.numero}</strong>
                              {contato.nome && contato.nome !== "Principal" ? (
                                <span className="text-muted-foreground">— {contato.nome}</span>
                              ) : null}
                            </span>
                          ))}
                        </dd>
                      </div>
                    ) : null}
                    <DetailItem label="Número do B.O." value={person.numero_bo} />
                    <DetailItem label="Procedimento" value={person.numero_procedimento} />
                    {!person.telefones.length &&
                    !person.numero_bo &&
                    !person.numero_procedimento ? (
                      <p className="text-xs text-muted-foreground">
                        Nenhum contato ou procedimento informado.
                      </p>
                    ) : null}
                  </dl>
                </section>
              </div>

              {person.endereco ? (
                <section className="rounded-xl border border-operational/25 bg-background p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-operational/30 bg-operational/10 text-operational">
                      <MapPin className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-operational">
                        Endereço vinculado
                      </p>
                      <h3 className="mt-1 break-words text-base font-black">
                        {formatAddress(person.endereco)}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[person.endereco.complemento, person.endereco.bairro]
                          .filter(Boolean)
                          .join(" · ") || "Bairro e complemento não informados"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {person.endereco.municipio} · {person.endereco.uf}
                        {person.endereco.cep ? ` · CEP ${person.endereco.cep}` : ""}
                      </p>
                    </div>
                    {person.endereco.confirmado ? (
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/10 text-success"
                        title="Local confirmado em campo"
                      >
                        <ShieldCheck className="h-4 w-4" />
                      </span>
                    ) : null}
                  </div>

                  {person.endereco.ponto_referencia ? (
                    <div className="mt-4 rounded-xl border border-border bg-card p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Ponto de referência
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {person.endereco.ponto_referencia}
                      </p>
                    </div>
                  ) : null}

                  {person.endereco.como_chegar ? (
                    <div className="mt-3 rounded-xl border border-warning/30 bg-warning/5 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-warning">
                        Como chegar
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm font-semibold">
                        {person.endereco.como_chegar}
                      </p>
                    </div>
                  ) : null}

                  {mapTarget ? (
                    <div className="mt-4 border-t border-border pt-4">
                      <div className="mb-2 flex items-center gap-2 text-xs font-bold text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 text-operational" /> Google Maps
                      </div>
                      <AbrirNoMapa
                        target={mapTarget}
                        urlManual={person.endereco.maps_url}
                        size="md"
                        className="[&_a]:min-h-10 [&_a]:flex-1 [&_a]:justify-center"
                      />
                    </div>
                  ) : null}
                </section>
              ) : (
                <section className="rounded-xl border border-dashed border-border bg-background p-4 text-center">
                  <MapPin className="mx-auto h-6 w-6 text-muted-foreground" />
                  <p className="mt-2 text-sm font-semibold">Nenhum endereço vinculado.</p>
                </section>
              )}

              {present(person.observacoes) ? (
                <section className="rounded-xl border border-border bg-background p-4">
                  <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                    <CalendarDays className="h-4 w-4" />
                    <h3 className="text-xs font-black uppercase tracking-wider">Observações</h3>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {person.observacoes}
                  </p>
                </section>
              ) : null}

              <div className="flex items-center gap-2 rounded-xl border border-border bg-background p-3 text-[11px] text-muted-foreground">
                <Phone className="h-4 w-4 shrink-0 text-operational" />
                Dados exibidos conforme a autorização do usuário conectado.
              </div>
            </div>
          ) : null}
        </div>
      </section>
      {deleteOpen && person ? (
        <div className="fixed inset-0 z-[1120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <section className="w-full max-w-md rounded-2xl border border-destructive/35 bg-card p-5 shadow-[0_0_50px_color-mix(in_oklab,var(--destructive)_16%,transparent)]">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <Trash2 className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-lg font-black">Excluir contato</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  <strong className="text-foreground">{person.nome}</strong> vai sair da lista de
                  pessoas/contatos e do mapa operacional. Endereços e rotas salvas permanecem
                  preservados.
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
                onClick={() => setDeleteOpen(false)}
                disabled={deleting}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold transition hover:bg-accent disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleDeletePerson()}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition hover:brightness-110 disabled:opacity-60"
              >
                {deleting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {deleting ? "Excluindo..." : "Excluir contato"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
