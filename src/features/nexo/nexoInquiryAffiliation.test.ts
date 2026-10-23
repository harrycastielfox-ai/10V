import { describe, expect, it } from "vitest";
import {
  createNexoInquiryOrganizationSelectionPatch,
  getNexoInquiryAssociationStatus,
  getNexoVinculoStatusLabel,
} from "./nexoInquiryAffiliation";

describe("createNexoInquiryOrganizationSelectionPatch", () => {
  it("clears faction details from the previous selection", () => {
    expect(createNexoInquiryOrganizationSelectionPatch("org-2", null)).toEqual({
      nexoOrganizacaoId: "org-2",
      nexoVinculoId: null,
      faccaoNomeInformada: "",
      faccaoSiglaInformada: "",
      funcaoFaccaoInformada: "",
      faccaoFonteInformada: "",
    });
  });

  it("keeps only the IDs when selecting an existing NEXO link", () => {
    const patch = createNexoInquiryOrganizationSelectionPatch("org-2", "link-2");

    expect(patch.nexoOrganizacaoId).toBe("org-2");
    expect(patch.nexoVinculoId).toBe("link-2");
    expect(patch.funcaoFaccaoInformada).toBe("");
    expect(patch.faccaoFonteInformada).toBe("");
  });
});

describe("getNexoVinculoStatusLabel", () => {
  it("uses explicit relationship language for every NEXO status", () => {
    expect(getNexoVinculoStatusLabel("confirmado")).toBe("Vínculo confirmado");
    expect(getNexoVinculoStatusLabel("provavel")).toBe("Vínculo provável");
    expect(getNexoVinculoStatusLabel("suspeito")).toBe("Vínculo suspeito");
    expect(getNexoVinculoStatusLabel("nao_confirmado")).toBe("Vínculo não confirmado");
    expect(getNexoVinculoStatusLabel("desvinculado")).toBe("Vínculo desvinculado");
  });

  it("preserves an unknown status instead of inventing a label", () => {
    expect(getNexoVinculoStatusLabel("outro_estado")).toBe("outro_estado");
  });
});

describe("getNexoInquiryAssociationStatus", () => {
  it("distinguishes an NEXO organization from a manually reported affiliation", () => {
    expect(
      getNexoInquiryAssociationStatus({ hasNexoOrganization: true, hasReportedData: true }),
    ).toBe("Facção cadastrada no NEXO · vínculo da pessoa não selecionado");
    expect(
      getNexoInquiryAssociationStatus({ hasNexoOrganization: false, hasReportedData: true }),
    ).toBe("Informado neste procedimento · não confirmado no NEXO");
  });

  it("does not imply a faction when none was selected or reported", () => {
    expect(
      getNexoInquiryAssociationStatus({ hasNexoOrganization: false, hasReportedData: false }),
    ).toBe("Nenhum vínculo de facção selecionado");
  });
});
