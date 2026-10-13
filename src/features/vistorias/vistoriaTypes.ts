export type VehicleInspectionStatus = "rascunho" | "emitido" | "cancelado";

export type VehicleInspectionFindings = {
  identification?: string;
  structure?: string;
  conservation?: string;
  accessories?: string;
  observations?: string;
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

export type VehicleInspectionChecklist = Record<string, "presente" | "ausente" | "nao_informado">;

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
    brand_model: string | null;
    plate: string | null;
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
