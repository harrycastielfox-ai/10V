import type { NexoVinculoStatus } from "./nexoTypes";
import type { InquiryPersonFormValue } from "@/lib/operationalContracts";

const STATUS_LABEL: Record<NexoVinculoStatus, string> = {
  confirmado: "Vínculo confirmado",
  provavel: "Vínculo provável",
  suspeito: "Vínculo suspeito",
  nao_confirmado: "Vínculo não confirmado",
  desvinculado: "Vínculo desvinculado",
};

export function getNexoVinculoStatusLabel(status: NexoVinculoStatus | string) {
  return STATUS_LABEL[status as NexoVinculoStatus] ?? status;
}

export function createNexoInquiryOrganizationSelectionPatch(
  organizationId: string | null,
  linkId: string | null,
): Partial<InquiryPersonFormValue> {
  return {
    nexoOrganizacaoId: organizationId,
    nexoVinculoId: linkId,
    faccaoNomeInformada: "",
    faccaoSiglaInformada: "",
    funcaoFaccaoInformada: "",
    faccaoFonteInformada: "",
  };
}

export function getNexoInquiryAssociationStatus({
  hasNexoOrganization,
  hasReportedData,
}: {
  hasNexoOrganization: boolean;
  hasReportedData: boolean;
}) {
  if (hasNexoOrganization) {
    return "Facção cadastrada no NEXO · vínculo da pessoa não selecionado";
  }
  if (hasReportedData) return "Informado neste procedimento · não confirmado no NEXO";
  return "Nenhum vínculo de facção selecionado";
}
