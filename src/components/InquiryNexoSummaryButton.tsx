import * as Dialog from "@radix-ui/react-dialog";
import { ExternalLink, ShieldAlert, UserRound, X } from "lucide-react";
import { useState } from "react";
import type {
  NexoInquiryOrganizationOption,
  NexoInquiryPersonOption,
} from "@/features/nexo/nexoTypes";
import {
  getNexoInquiryAssociationStatus,
  getNexoVinculoStatusLabel,
} from "@/features/nexo/nexoInquiryAffiliation";

export function InquiryNexoSummaryButton({
  nexoPersonId,
  nexoOrganizationId,
  nexoLinkId,
  factionName,
  factionSigla,
  reportedFunction,
  reportedSource,
  person,
  organization: nexoOrganization,
  canAccessNexo,
}: {
  nexoPersonId: string | null;
  nexoOrganizationId: string | null;
  nexoLinkId: string | null;
  factionName: string | null;
  factionSigla: string | null;
  reportedFunction: string | null;
  reportedSource: string | null;
  person: NexoInquiryPersonOption | null;
  organization: NexoInquiryOrganizationOption | null;
  canAccessNexo: boolean;
}) {
  const [open, setOpen] = useState(false);
  const hasNexoReference = Boolean(nexoPersonId || nexoOrganizationId || nexoLinkId);
  const hasReportedData = Boolean(
    factionName || factionSigla || reportedFunction || reportedSource,
  );
  if ((hasNexoReference && !canAccessNexo) || (!hasNexoReference && !hasReportedData)) return null;

  const link = person?.vinculos.find((item) => item.id === nexoLinkId);
  const organization =
    link?.organizacao ??
    person?.vinculos.find((item) => item.organizacao_id === nexoOrganizationId)?.organizacao ??
    nexoOrganization;
  const status = link
    ? getNexoVinculoStatusLabel(link.status)
    : nexoLinkId
      ? "Vínculo NEXO indisponível para consulta"
      : getNexoInquiryAssociationStatus({
          hasNexoOrganization: Boolean(nexoOrganizationId),
          hasReportedData,
        });
  const sigla = organization?.sigla || factionSigla;
  const nomeFaccao = organization?.nome || factionName;
  const funcao = link?.funcao ?? reportedFunction;
  const fonte = link?.fonte_resumo ?? reportedSource;

  return (
    <div className="sipi-print-hidden inline-flex items-center gap-6">
      {sigla ? (
        <span className="inline-flex max-w-28 items-center truncate rounded-sm border border-rose-500/35 bg-rose-500/10 px-2 py-1 text-[10px] font-extrabold text-rose-700">
          {sigla}
        </span>
      ) : null}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-primary/45 bg-primary/10 px-3 text-xs font-bold text-primary shadow-sm transition hover:border-primary/65 hover:bg-primary/15 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
            title="Abrir resumo da associação"
          >
            <ShieldAlert className="size-4" /> Abrir resumo
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/55 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-4 shadow-2xl outline-none">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-primary">
                  Resumo da associação
                </p>
                <Dialog.Title className="mt-1 text-base font-extrabold text-foreground">
                  {person?.nome ??
                    organization?.nome ??
                    (nexoPersonId ? "Perfil NEXO indisponível" : "Facção informada")}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-xs leading-5 text-muted-foreground">
                  Dados NEXO e informações registradas neste procedimento aparecem identificados por
                  origem.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Fechar resumo"
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-accent hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </Dialog.Close>
            </div>

            <div className="mt-4 flex gap-3 rounded-md border border-border/70 bg-background/45 p-3">
              {person?.foto_perfil_url ? (
                <img
                  src={person.foto_perfil_url}
                  alt={`Foto de ${person.nome}`}
                  className="size-[4.5rem] shrink-0 rounded-md object-cover"
                />
              ) : (
                <span className="grid size-[4.5rem] shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                  <UserRound className="size-7" />
                </span>
              )}
              <dl className="min-w-0 space-y-2 text-xs">
                <div>
                  <dt className="text-[10px] font-bold uppercase text-muted-foreground">
                    Nome completo
                  </dt>
                  <dd className="break-words font-semibold text-foreground">
                    {person?.nome ??
                      (nexoPersonId
                        ? "Perfil indisponível para consulta"
                        : "Sem perfil NEXO associado")}
                  </dd>
                </div>
                {person?.cpf ? (
                  <div>
                    <dt className="text-[10px] font-bold uppercase text-muted-foreground">CPF</dt>
                    <dd className="font-semibold text-foreground">{person.cpf}</dd>
                  </div>
                ) : null}
              </dl>
            </div>

            <dl className="mt-3 divide-y divide-border/60 rounded-md border border-border/70 px-3">
              <SummaryField label="Facção" value={nomeFaccao || "Não informada"} />
              <SummaryField
                label="Função na facção"
                value={funcao || "Não informada"}
                detail={
                  link?.funcao
                    ? "Dado atual do vínculo NEXO"
                    : reportedFunction
                      ? "Informação deste procedimento"
                      : undefined
                }
              />
              <SummaryField label="Estado do vínculo" value={status} />
              <SummaryField
                label="Fonte"
                value={fonte || (link ? "Não informada no NEXO" : "Não informada")}
                detail={
                  link?.fonte_resumo
                    ? "Fonte registrada no NEXO"
                    : reportedSource
                      ? "Informação deste procedimento"
                      : undefined
                }
              />
            </dl>

            {person ? (
              <a
                href={`/nexo?personId=${encodeURIComponent(person.id)}`}
                className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 text-xs font-bold text-primary transition hover:bg-primary/15"
              >
                Ir ao perfil completo no NEXO <ExternalLink className="size-3.5" />
              </a>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function SummaryField({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="py-2.5">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-xs font-semibold text-foreground">{value}</dd>
      {detail ? <dd className="mt-0.5 text-[10px] text-muted-foreground">{detail}</dd> : null}
    </div>
  );
}
