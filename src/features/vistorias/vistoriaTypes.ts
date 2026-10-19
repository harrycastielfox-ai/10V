export type VehicleInspectionStatus = "rascunho" | "emitido" | "cancelado";

export type VehicleInspectionFindings = {
  identification?: string;
  structure?: string;
  conservation?: string;
  accessories?: string;
  observations?: string;
  result?: string;
  measures_taken?: string;
};

export const INSPECTION_PRESENTATION_REASONS = [
  "suspeita_adulteracao_sinais",
  "suspeita_clonagem",
  "recuperacao_furto_roubo",
  "trafico_drogas",
  "acidente",
  "local_crime",
  "verificacao",
  "condutor_nao_habilitado",
  "instrumento_crime",
  "veiculo_abandonado",
  "outros",
] as const;

export type InspectionPresentationReason = (typeof INSPECTION_PRESENTATION_REASONS)[number];

export const INSPECTION_PRESENTING_INSTITUTIONS = [
  "policia_militar",
  "policia_civil",
  "policia_rodoviaria_federal",
  "policia_federal",
  "guarda_municipal",
  "outros",
] as const;

export type InspectionPresentingInstitution = (typeof INSPECTION_PRESENTING_INSTITUTIONS)[number];

export const INSPECTION_YARD_TYPES = [
  "pericia",
  "guincho",
  "prf",
  "detran",
  "delegacia",
  "disep",
  "outros",
] as const;

export type InspectionYardType = (typeof INSPECTION_YARD_TYPES)[number];

export type VehicleInspectionChecklistStatus = "presente" | "ausente" | "nao_informado";

export type VehicleInspectionOilLevel = "adequado" | "baixo" | "critico" | "nao_verificado";

export type VehicleInspectionAnswer = "sim" | "nao" | "nao_informado";

export type VehicleInspectionFuelLevel =
  "vazio" | "reserva" | "um_quarto" | "meio" | "tres_quartos" | "cheio" | "nao_verificado";

export type VehicleInspectionVehicleCondition = "servivel" | "inservivel" | "nao_informado";

export type VehicleInspectionQuestionnaireKey =
  | "registered_before_law_13352"
  | "related_to_drug_trafficking"
  | "proceeding_information_unavailable"
  | "seizure_date_unavailable"
  | "judicial_auction_requested"
  | "detran_infraction_requested"
  | "public_notice_requested"
  | "early_disposal_requested"
  | "owner_or_insurer_notified"
  | "awaiting_public_notice"
  | "under_judicial_restriction"
  | "administrative_occurrence_linked"
  | "authorized_to_circulate"
  | "available_for_auction";

export type VehicleInspectionAssessment = {
  stolen_or_robbed?: VehicleInspectionAnswer;
  other_restrictions?: VehicleInspectionAnswer;
  identifier_divergence?: VehicleInspectionAnswer;
  original_characteristics_identified?: VehicleInspectionAnswer;
  obd_examined?: VehicleInspectionAnswer;
  expert_examined?: VehicleInspectionAnswer;
  tampering_confirmed?: VehicleInspectionAnswer;
  divergence_indicators?: string[];
  questionnaire?: Partial<Record<VehicleInspectionQuestionnaireKey, VehicleInspectionAnswer>>;
};

export type VehicleInspectionTechnicalData = {
  oil_level?: VehicleInspectionOilLevel;
  wheel_brand?: string;
  wheel_rim?: string;
  mileage_km?: number | null;
  fuel_level?: VehicleInspectionFuelLevel;
  vehicle_condition?: VehicleInspectionVehicleCondition;
  damage_notes?: string;
  assessment?: VehicleInspectionAssessment;
};

export type VehicleInspectionChecklist = Partial<
  Record<
    | "estepe"
    | "chave_de_rodas"
    | "triangulo"
    | "macaco"
    | "tapetes"
    | "chave_crv_crlv"
    | "nivel_oleo"
    | "rodas_aro"
    | "quilometragem",
    VehicleInspectionChecklistStatus
  >
> & {
  technical?: VehicleInspectionTechnicalData;
};

export const INSPECTION_PHOTO_CATEGORIES = [
  "veiculo",
  "chassi",
  "motor",
  "etiqueta_seguranca",
  "placa",
  "sinal_identificador",
  "outros",
] as const;

export type InspectionPhotoCategory = (typeof INSPECTION_PHOTO_CATEGORIES)[number];

export type VehicleInspectionPhoto = {
  id: string;
  inspection_id: string;
  vehicle_photo_id: string;
  category: InspectionPhotoCategory;
  caption: string | null;
  created_at: string;
  vehicle_photo: {
    id: string;
    thumbnail_url: string | null;
    original_url: string | null;
  } | null;
};

export type VehicleInspection = {
  id: string;
  vehicle_id: string;
  status: VehicleInspectionStatus;
  inspection_date: string;
  location: string | null;
  inspector_notes: string | null;
  police_report_number: string | null;
  presentation_reason: InspectionPresentationReason | null;
  presenting_institution: InspectionPresentingInstitution | null;
  yard_type: InspectionYardType | null;
  yard_location: string | null;
  delivery_restricted: boolean;
  checklist: VehicleInspectionChecklist;
  linked_people: string[];
  original_vehicle_data: Record<string, unknown>;
  findings: VehicleInspectionFindings;
  current_version: number;
  pdf_storage_path: string | null;
  pdf_sha256: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  vehicle?: {
    id: string;
    internal_id: string;
    brand: string | null;
    model: string | null;
    brand_model: string | null;
    color: string | null;
    plate: string | null;
    engine_number: string | null;
    chassis: string | null;
    manufacture_year: number | null;
    model_year: number | null;
    conservation_state: string | null;
  } | null;
};

export type CreateVehicleInspectionInput = {
  vehicle_id: string;
  inspection_date: string;
  location?: string | null;
  inspector_notes?: string | null;
  police_report_number?: string | null;
  presentation_reason?: InspectionPresentationReason | null;
  presenting_institution?: InspectionPresentingInstitution | null;
  yard_type?: InspectionYardType | null;
  yard_location?: string | null;
  delivery_restricted?: boolean;
  checklist?: VehicleInspectionChecklist;
  linked_people?: string[];
  original_vehicle_data?: Record<string, unknown>;
  findings?: VehicleInspectionFindings;
};
