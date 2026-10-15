import type {
  InspectionPhotoCategory,
  VehicleInspection,
  VehicleInspectionPhoto,
} from "@/features/vistorias/vistoriaTypes";

const PRESENTATION_REASON_LABELS: Record<string, string> = {
  suspeita_adulteracao_sinais: "suspeita de adulteração de sinais identificadores",
  suspeita_clonagem: "suspeita de clonagem",
  recuperacao_furto_roubo: "recuperação relacionada a furto ou roubo",
  trafico_drogas: "ocorrência relacionada a tráfico de drogas",
  acidente: "acidente",
  local_crime: "vínculo com local de crime",
  verificacao: "verificação",
  condutor_nao_habilitado: "condutor não habilitado",
  instrumento_crime: "possível utilização como instrumento de crime",
  veiculo_abandonado: "veículo abandonado",
  outros: "outro motivo informado",
};

const INSTITUTION_LABELS: Record<string, string> = {
  policia_militar: "Polícia Militar",
  policia_civil: "Polícia Civil",
  policia_rodoviaria_federal: "Polícia Rodoviária Federal",
  policia_federal: "Polícia Federal",
  guarda_municipal: "Guarda Municipal",
  outros: "Outra instituição informada",
};

const YARD_LABELS: Record<string, string> = {
  pericia: "Perícia",
  guincho: "Guincho",
  prf: "PRF",
  detran: "DETRAN",
  delegacia: "Delegacia",
  disep: "DISEP",
  outros: "Outro destino",
};

const PHOTO_CATEGORY_LABELS: Record<InspectionPhotoCategory, string> = {
  veiculo: "Vista do veículo",
  chassi: "Chassi",
  motor: "Motor",
  etiqueta_seguranca: "Etiqueta de segurança",
  placa: "Placa",
  sinal_identificador: "Sinal identificador",
  outros: "Outro registro",
};

const CHECKLIST_ITEMS = [
  ["estepe", "Estepe"],
  ["chave_de_rodas", "Chave de rodas"],
  ["triangulo", "Triângulo"],
  ["macaco", "Macaco"],
  ["tapetes", "Tapetes"],
  ["chave_crv_crlv", "Chave/CRV/CRLV"],
  ["nivel_oleo", "Nível/óleo"],
  ["rodas_aro", "Rodas/aro"],
  ["quilometragem", "Quilometragem"],
] as const;

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "Não informado";
  return String(value);
}

function snapshotValue(snapshot: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = snapshot[key];
    if (value !== null && value !== undefined && value !== "") return String(value);
  }
  return "Não informado";
}

function formatInspectionDate(value: string, long = false) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat(
    "pt-BR",
    long ? { day: "2-digit", month: "long", year: "numeric" } : undefined,
  ).format(date);
}

function buildPreamble(inspection: VehicleInspection) {
  const vehicle = inspection.vehicle;
  const identification = [
    vehicle?.brand_model ? `veículo ${vehicle.brand_model}` : "veículo cadastrado no SIED",
    vehicle?.plate ? `placa ${vehicle.plate}` : null,
    inspection.police_report_number
      ? `vinculado à ocorrência policial nº ${inspection.police_report_number}`
      : null,
  ]
    .filter(Boolean)
    .join(", ");
  const presentation = inspection.presentation_reason
    ? `, apresentado para ${PRESENTATION_REASON_LABELS[inspection.presentation_reason] ?? inspection.presentation_reason}`
    : "";
  const institution = inspection.presenting_institution
    ? ` pela ${INSTITUTION_LABELS[inspection.presenting_institution] ?? inspection.presenting_institution}`
    : "";
  return `Trata-se de ${identification}${presentation}${institution}. O presente registro consolida os dados informados e as constatações documentadas durante a vistoria.`;
}

function PrintPhotoGrid({
  title,
  photos,
  variant,
}: {
  title: string;
  photos: VehicleInspectionPhoto[];
  variant: "vehicle" | "identifier";
}) {
  if (!photos.length) return null;
  return (
    <section className="sipi-vistoria-block sipi-vistoria-photo-block">
      <h2>{title}</h2>
      <div
        className={`sipi-vistoria-photo-grid is-${variant}${photos.length === 3 ? " has-three" : ""}`}
      >
        {photos.map((photo) => (
          <figure key={photo.id}>
            {photo.vehicle_photo?.original_url || photo.vehicle_photo?.thumbnail_url ? (
              <img
                className="sipi-vistoria-print-photo"
                src={photo.vehicle_photo.original_url ?? photo.vehicle_photo.thumbnail_url ?? ""}
                alt=""
              />
            ) : (
              <div className="sipi-vistoria-photo-missing">Imagem indisponível</div>
            )}
            <figcaption>
              {PHOTO_CATEGORY_LABELS[photo.category]}
              {photo.caption ? ` - ${photo.caption}` : ""}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

export function VehicleInspectionPrintSheet({
  inspection,
  photos,
}: {
  inspection: VehicleInspection;
  photos: VehicleInspectionPhoto[];
}) {
  const vehicle = inspection.vehicle;
  const vehiclePhotos = photos.filter((photo) => photo.category === "veiculo");
  const identifierPhotos = photos.filter((photo) => photo.category !== "veiculo");
  const original = inspection.original_vehicle_data ?? {};
  const findings = inspection.findings ?? {};
  const destination = inspection.yard_type
    ? (YARD_LABELS[inspection.yard_type] ?? inspection.yard_type)
    : null;
  const results = [
    findings.identification,
    findings.structure,
    findings.conservation,
    findings.accessories,
    inspection.inspector_notes,
  ].filter((value): value is string => Boolean(value?.trim()));

  return (
    <div className="print-only sipi-print-sheet sipi-vistoria-report" aria-hidden="true">
      <header className="sipi-vistoria-letterhead">
        <div className="sipi-vistoria-emblem-wrap">
          <img src="/policia-civil-bahia-brasao-pdf.png" alt="" />
        </div>
        <div className="sipi-vistoria-agency">
          <strong>POLÍCIA CIVIL DA BAHIA</strong>
          <span>DEPARTAMENTO DE POLÍCIA DO INTERIOR</span>
          <span>23ª COORDENADORIA REGIONAL DE POLÍCIA</span>
          <span>DELEGACIA TERRITORIAL DE ITABELA</span>
          <small>SIED - Sistema Integrado de Evidências e Dados</small>
        </div>
        <div className="sipi-vistoria-document-id">
          <span>REGISTRO</span>
          <strong>{inspection.vehicle?.internal_id ?? inspection.id.slice(0, 8)}</strong>
          <small>Versão {inspection.current_version}</small>
        </div>
      </header>

      <div className="sipi-vistoria-title">
        <span>RELATÓRIO DE VISTORIA VEICULAR</span>
        <strong>{inspection.police_report_number || "REGISTRO OPERACIONAL"}</strong>
      </div>

      <section className="sipi-vistoria-block">
        <h2>1. PREÂMBULO</h2>
        <p className="sipi-vistoria-narrative">{buildPreamble(inspection)}</p>
      </section>

      <section className="sipi-vistoria-block">
        <h2>2. CARACTERÍSTICAS OSTENTADAS</h2>
        <dl className="sipi-vistoria-data-grid">
          <div>
            <dt>Marca</dt>
            <dd>{displayValue(vehicle?.brand)}</dd>
          </div>
          <div>
            <dt>Modelo</dt>
            <dd>{displayValue(vehicle?.model ?? vehicle?.brand_model)}</dd>
          </div>
          <div>
            <dt>Placa</dt>
            <dd>{displayValue(vehicle?.plate)}</dd>
          </div>
          <div>
            <dt>Chassi</dt>
            <dd>{displayValue(vehicle?.chassis)}</dd>
          </div>
          <div>
            <dt>Motor</dt>
            <dd>{displayValue(vehicle?.engine_number)}</dd>
          </div>
          <div>
            <dt>Cor</dt>
            <dd>{displayValue(vehicle?.color)}</dd>
          </div>
          <div>
            <dt>Ano fabricação</dt>
            <dd>{displayValue(vehicle?.manufacture_year)}</dd>
          </div>
          <div>
            <dt>Ano modelo</dt>
            <dd>{displayValue(vehicle?.model_year)}</dd>
          </div>
          <div>
            <dt>Conservação</dt>
            <dd>{displayValue(vehicle?.conservation_state)}</dd>
          </div>
        </dl>
      </section>

      <section className="sipi-vistoria-block">
        <h2>3. CHECKLIST</h2>
        <div className="sipi-vistoria-checklist">
          {CHECKLIST_ITEMS.map(([key, label]) => {
            const status = inspection.checklist?.[key];
            const value =
              status === "presente"
                ? "Presente"
                : status === "ausente"
                  ? "Ausente"
                  : "Não informado";
            return (
              <div key={key}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            );
          })}
        </div>
      </section>

      <PrintPhotoGrid
        title="4. REGISTRO FOTOGRÁFICO DO VEÍCULO"
        photos={vehiclePhotos}
        variant="vehicle"
      />
      <PrintPhotoGrid
        title="5. REGISTRO FOTOGRÁFICO DOS SINAIS IDENTIFICADORES"
        photos={identifierPhotos}
        variant="identifier"
      />

      <section className="sipi-vistoria-block sipi-vistoria-analysis">
        <h2>6. CONSTATAÇÕES E RESULTADOS OBTIDOS</h2>
        {findings.identification ? (
          <div className="sipi-vistoria-result">
            <strong>Identificação e sinais</strong>
            <p>{findings.identification}</p>
          </div>
        ) : null}
        {findings.structure ? (
          <div className="sipi-vistoria-result">
            <strong>Estrutura e integridade</strong>
            <p>{findings.structure}</p>
          </div>
        ) : null}
        {findings.conservation ? (
          <div className="sipi-vistoria-result">
            <strong>Estado de conservação</strong>
            <p>{findings.conservation}</p>
          </div>
        ) : null}
        {findings.accessories ? (
          <div className="sipi-vistoria-result">
            <strong>Acessórios e itens adicionais</strong>
            <p>{findings.accessories}</p>
          </div>
        ) : null}
        {inspection.inspector_notes ? (
          <div className="sipi-vistoria-result">
            <strong>Observações do vistoriador</strong>
            <p>{inspection.inspector_notes}</p>
          </div>
        ) : null}
        {!results.length ? (
          <p className="sipi-vistoria-narrative">
            Não foram registradas constatações técnicas adicionais.
          </p>
        ) : null}
      </section>

      <section className="sipi-vistoria-block">
        <h2>7. DADOS DO VEÍCULO ORIGINAL / REFERÊNCIA</h2>
        <dl className="sipi-vistoria-data-grid">
          <div>
            <dt>Marca</dt>
            <dd>{snapshotValue(original, "brand")}</dd>
          </div>
          <div>
            <dt>Modelo</dt>
            <dd>{snapshotValue(original, "model", "brand_model")}</dd>
          </div>
          <div>
            <dt>Placa</dt>
            <dd>{snapshotValue(original, "plate")}</dd>
          </div>
          <div>
            <dt>Chassi</dt>
            <dd>{snapshotValue(original, "chassis")}</dd>
          </div>
          <div>
            <dt>Motor</dt>
            <dd>{snapshotValue(original, "engine_number")}</dd>
          </div>
          <div>
            <dt>Cor</dt>
            <dd>{snapshotValue(original, "color")}</dd>
          </div>
          <div>
            <dt>Ano fabricação</dt>
            <dd>{snapshotValue(original, "manufacture_year")}</dd>
          </div>
          <div>
            <dt>Ano modelo</dt>
            <dd>{snapshotValue(original, "model_year")}</dd>
          </div>
          <div>
            <dt>Registro SIED</dt>
            <dd>{snapshotValue(original, "internal_id")}</dd>
          </div>
        </dl>
      </section>

      <section className="sipi-vistoria-block sipi-vistoria-operational-grid">
        <div>
          <h2>8. CUSTÓDIA E DESTINO</h2>
          <p>
            <strong>Local da vistoria:</strong> {displayValue(inspection.location)}
          </p>
          <p>
            <strong>Destino:</strong> {displayValue(destination)}
          </p>
          <p>
            <strong>Local do pátio:</strong> {displayValue(inspection.yard_location)}
          </p>
          <p>
            <strong>Restrição de entrega:</strong> {inspection.delivery_restricted ? "Sim" : "Não"}
          </p>
        </div>
        <div>
          <h2>9. PESSOAS VINCULADAS</h2>
          {inspection.linked_people?.length ? (
            inspection.linked_people.map((person) => <p key={person}>{person}</p>)
          ) : (
            <p>Não informado</p>
          )}
        </div>
      </section>

      <section className="sipi-vistoria-block sipi-vistoria-place-date">
        <h2>10. LOCAL E DATA</h2>
        <p>
          {displayValue(inspection.location)},{" "}
          {formatInspectionDate(inspection.inspection_date, true)}
        </p>
      </section>

      <section className="sipi-vistoria-block sipi-vistoria-signature">
        <h2>11. RESPONSÁVEL PELO REGISTRO</h2>
        <div>
          <span>____________________________________________</span>
          <strong>Servidor responsável</strong>
          <small>Identificação funcional preservada na trilha de auditoria do SIED</small>
        </div>
      </section>

      <footer className="sipi-vistoria-footer">
        <span>SIED - Polícia Civil da Bahia</span>
        <span>Documento operacional de uso interno e restrito</span>
      </footer>
    </div>
  );
}
