export type VehicleInspectionStatus = "rascunho" | "emitido" | "cancelado";

export type VehicleInspectionFindings = {
  identification?: string;
  structure?: string;
  conservation?: string;
  accessories?: string;
  observations?: string;
};

export type VehicleInspection = {
  id: string;
  vehicle_id: string;
  status: VehicleInspectionStatus;
  inspection_date: string;
  location: string | null;
  inspector_notes: string | null;
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
  findings?: VehicleInspectionFindings;
};
