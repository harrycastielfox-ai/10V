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
] as const;

const OIL_LEVEL_LABELS = {
  adequado: "Adequado",
  baixo: "Baixo",
  critico: "Crítico",
  nao_verificado: "Não verificado",
} as const;

const FUEL_LEVEL_LABELS = {
  vazio: "Vazio",
  reserva: "Reserva",
  um_quarto: "1/4",
  meio: "1/2",
  tres_quartos: "3/4",
  cheio: "Cheio",
  nao_verificado: "Não verificado",
} as const;

const DIVERGENCE_LABELS: Record<string, string> = {
  missing_plate_preserved_identifiers: "Sem placa, demais identificadores preservados",
  replaced_plate_preserved_identifiers: "Placa trocada, demais identificadores preservados",
  possible_clone: "Indícios de clonagem",
  obd_vin_mismatch: "VIN lido via OBD diverge do ostentado",
  original_number_recovered: "Numeração original identificada em agregado",
  identifier_number_missing: "Ausência completa de numeração identificadora",
  visible_identifier_tampering: "Adulteração visível por raspagem, sobreposição ou implante",
  parts_date_mismatch: "Datas de peças incompatíveis com os sinais ostentados",
  original_vin_with_stolen_part: "VIN original com agregado de veículo furtado/roubado",
};

const QUESTIONNAIRE_LABELS: Record<string, string> = {
  registered_before_law_13352: "Cadastro anterior à Lei 13.352/2015",
  related_to_drug_trafficking: "Relação com tráfico de drogas ou crimes afins",
  proceeding_information_unavailable: "Procedência policial não identificada",
  seizure_date_unavailable: "Data da apreensão não identificada",
  judicial_auction_requested: "Autorização judicial para leilão solicitada",
  detran_infraction_requested: "DETRAN/CIRETRAN oficiado",
  public_notice_requested: "Publicação de edital solicitada",
  early_disposal_requested: "Alienação antecipada solicitada",
  owner_or_insurer_notified: "Proprietário ou seguradora notificado",
  awaiting_public_notice: "Aguardando prazo de edital",
  under_judicial_restriction: "Objeto de restrição ou sindicância",
  administrative_occurrence_linked: "Ocorrência administrativa vinculada a IP/TCO",
  authorized_to_circulate: "Autorizado judicialmente a circular",
  available_for_auction: "Disponível para leilão",
};

function answerLabel(value: string | undefined) {
  if (value === "sim") return "Sim";
  if (value === "nao") return "Não";
  return "Não informado";
}

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

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function inspectionStatusLabel(status: VehicleInspection["status"]) {
  const labels: Record<string, string> = {
    rascunho: "Em elaboração",
    em_revisao: "Em revisão",
    concluida: "Concluída",
    cancelada: "Cancelada",
  };
  return labels[status] ?? status;
}

function buildPreamble(inspection: VehicleInspection) {
  const vehicle = inspection.vehicle;
  const ostensible = inspection.findings?.ostensible_vehicle ?? {};
  const displayedModel = [ostensible.brand, ostensible.model].filter(Boolean).join(" ");
  const identification = [
    displayedModel || vehicle?.brand_model
      ? `veículo ${displayedModel || vehicle?.brand_model}`
      : "veículo cadastrado no SIED",
    ostensible.plate || vehicle?.plate ? `placa ${ostensible.plate || vehicle?.plate}` : null,
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
  sequenceStart,
  description,
}: {
  title: string;
  photos: VehicleInspectionPhoto[];
  variant: "vehicle" | "identifier";
  sequenceStart: number;
  description?: string;
}) {
  if (!photos.length && !description?.trim()) return null;
  return (
    <section className="sipi-vistoria-block sipi-vistoria-photo-block">
      <h2>{title}</h2>
      <div
        className={`sipi-vistoria-photo-grid is-${variant}${photos.length === 3 ? " has-three" : ""}`}
      >
        {photos.map((photo, index) => (
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
              <span>EVIDÊNCIA {String(sequenceStart + index).padStart(2, "0")}</span>
              <strong>
                {PHOTO_CATEGORY_LABELS[photo.category]}
                {photo.caption ? ` - ${photo.caption}` : ""}
              </strong>
            </figcaption>
          </figure>
        ))}
      </div>
      {description?.trim() ? (
        <p className="sipi-vistoria-photo-description">{description}</p>
      ) : null}
    </section>
  );
}

export function VehicleInspectionPrintSheet({
  inspection,
  photos,
  preview = false,
}: {
  inspection: VehicleInspection;
  photos: VehicleInspectionPhoto[];
  preview?: boolean;
}) {
  const vehicle = inspection.vehicle;
  const vehiclePhotos = photos.filter((photo) => photo.category === "veiculo");
  const identifierPhotos = photos.filter((photo) => photo.category !== "veiculo");
  const original = inspection.original_vehicle_data ?? {};
  const findings = inspection.findings ?? {};
  const ostensible = findings.ostensible_vehicle ?? {};
  const destination = inspection.yard_type
    ? (YARD_LABELS[inspection.yard_type] ?? inspection.yard_type)
    : null;
  const results = [
    findings.identification,
    findings.structure,
    findings.conservation,
    findings.accessories,
    findings.result,
    findings.measures_taken,
    inspection.inspector_notes,
  ].filter((value): value is string => typeof value === "string" && Boolean(value.trim()));
  const checklistStatuses = CHECKLIST_ITEMS.map(
    ([key]) => inspection.checklist?.[key] ?? "nao_informado",
  );
  const checklistSummary = {
    present: checklistStatuses.filter((status) => status === "presente").length,
    absent: checklistStatuses.filter((status) => status === "ausente").length,
    uninformed: checklistStatuses.filter((status) => status === "nao_informado").length,
  };
  const technicalConclusion = findings.observations?.trim() || inspection.inspector_notes?.trim();
  const documentIntegrity = inspection.pdf_sha256 ? "Hash registrado" : "PDF pendente";
  const technicalData = inspection.checklist?.technical;
  const assessment = technicalData?.assessment;
  const answeredQuestionnaire = Object.entries(assessment?.questionnaire ?? {}).filter(
    ([, value]) => value && value !== "nao_informado",
  );
  const administrativeOffset = answeredQuestionnaire.length ? 1 : 0;

  return (
    <div
      className={`${preview ? "sipi-vistoria-screen-preview" : "print-only"} sipi-print-sheet sipi-vistoria-report`}
      aria-hidden={preview ? undefined : true}
    >
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

      <section className="sipi-vistoria-overview" aria-label="Resumo do registro">
        <div>
          <span>Veículo</span>
          <strong>
            {[ostensible.brand, ostensible.model].filter(Boolean).join(" ") ||
              vehicle?.brand_model ||
              vehicle?.model ||
              "Não informado"}
          </strong>
        </div>
        <div>
          <span>Placa</span>
          <strong>{displayValue(ostensible.plate || vehicle?.plate)}</strong>
        </div>
        <div>
          <span>Data da vistoria</span>
          <strong>{formatInspectionDate(inspection.inspection_date)}</strong>
        </div>
        <div>
          <span>Situação</span>
          <strong>{inspectionStatusLabel(inspection.status)}</strong>
        </div>
        <div>
          <span>Evidências</span>
          <strong>{photos.length} registro(s)</strong>
        </div>
        <div>
          <span>Integridade</span>
          <strong>{documentIntegrity}</strong>
        </div>
      </section>

      <section className="sipi-vistoria-block">
        <h2>1. PREÂMBULO</h2>
        <p className="sipi-vistoria-narrative">{buildPreamble(inspection)}</p>
      </section>

      <section className="sipi-vistoria-block">
        <h2>2. CARACTERÍSTICAS OSTENTADAS</h2>
        <dl className="sipi-vistoria-data-grid">
          <div>
            <dt>Marca</dt>
            <dd>{displayValue(ostensible.brand || vehicle?.brand)}</dd>
          </div>
          <div>
            <dt>Modelo</dt>
            <dd>{displayValue(ostensible.model || vehicle?.model || vehicle?.brand_model)}</dd>
          </div>
          <div>
            <dt>Placa</dt>
            <dd>{displayValue(ostensible.plate || vehicle?.plate)}</dd>
          </div>
          <div>
            <dt>Chassi</dt>
            <dd>{displayValue(ostensible.chassis || vehicle?.chassis)}</dd>
          </div>
          <div>
            <dt>Motor</dt>
            <dd>{displayValue(ostensible.engine_number || vehicle?.engine_number)}</dd>
          </div>
          <div>
            <dt>Cor</dt>
            <dd>{displayValue(ostensible.color || vehicle?.color)}</dd>
          </div>
          <div>
            <dt>Ano fabricação</dt>
            <dd>{displayValue(ostensible.manufacture_year ?? vehicle?.manufacture_year)}</dd>
          </div>
          <div>
            <dt>Ano modelo</dt>
            <dd>{displayValue(ostensible.model_year ?? vehicle?.model_year)}</dd>
          </div>
          <div>
            <dt>Conservação</dt>
            <dd>{displayValue(vehicle?.conservation_state)}</dd>
          </div>
          <div>
            <dt>Renavam ostentado</dt>
            <dd>{displayValue(ostensible.renavam || vehicle?.renavam)}</dd>
          </div>
          <div>
            <dt>Tipo ostentado</dt>
            <dd>{displayValue(ostensible.vehicle_type || vehicle?.vehicle_type)}</dd>
          </div>
          <div>
            <dt>Descrição de chegada</dt>
            <dd>{displayValue(ostensible.description)}</dd>
          </div>
        </dl>
      </section>

      <section className="sipi-vistoria-block">
        <h2>3. CHECKLIST</h2>
        <div className="sipi-vistoria-checklist-summary">
          <span>
            <strong>{checklistSummary.present}</strong> presentes
          </span>
          <span>
            <strong>{checklistSummary.absent}</strong> ausentes
          </span>
          <span>
            <strong>{checklistSummary.uninformed}</strong> não informados
          </span>
        </div>
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
                <strong data-status={status ?? "nao_informado"}>{value}</strong>
              </div>
            );
          })}
        </div>
        <dl className="sipi-vistoria-technical-grid">
          <div>
            <dt>Nível do óleo</dt>
            <dd>
              {technicalData?.oil_level
                ? OIL_LEVEL_LABELS[technicalData.oil_level]
                : "Não informado"}
            </dd>
          </div>
          <div>
            <dt>Rodas / aro</dt>
            <dd>
              {[
                technicalData?.wheel_brand,
                technicalData?.wheel_rim ? `aro ${technicalData.wheel_rim}` : null,
              ]
                .filter(Boolean)
                .join(" · ") || "Não informado"}
            </dd>
          </div>
          <div>
            <dt>Quilometragem</dt>
            <dd>
              {technicalData?.mileage_km !== null && technicalData?.mileage_km !== undefined
                ? `${technicalData.mileage_km.toLocaleString("pt-BR")} km`
                : "Não informada"}
            </dd>
          </div>
          <div>
            <dt>Nível de combustível</dt>
            <dd>
              {technicalData?.fuel_level
                ? FUEL_LEVEL_LABELS[technicalData.fuel_level]
                : "Não informado"}
            </dd>
          </div>
          <div>
            <dt>Estado operacional</dt>
            <dd>
              {technicalData?.vehicle_condition === "servivel"
                ? "Servível"
                : technicalData?.vehicle_condition === "inservivel"
                  ? "Inservível"
                  : "Não informado"}
            </dd>
          </div>
          <div>
            <dt>Avarias aparentes</dt>
            <dd>{technicalData?.damage_notes || "Não informadas"}</dd>
          </div>
        </dl>
      </section>

      <PrintPhotoGrid
        title="4. REGISTRO FOTOGRÁFICO DO VEÍCULO"
        photos={vehiclePhotos}
        variant="vehicle"
        sequenceStart={1}
        description={findings.photo_vehicle_description}
      />
      <PrintPhotoGrid
        title="5. REGISTRO FOTOGRÁFICO DOS SINAIS IDENTIFICADORES"
        photos={identifierPhotos}
        variant="identifier"
        sequenceStart={vehiclePhotos.length + 1}
        description={findings.photo_identifiers_description}
      />

      {photos.length >= 4 ? (
        <div className="sipi-vistoria-continuation">
          <span>RELATÓRIO DE VISTORIA VEICULAR · CONTINUAÇÃO</span>
          <strong>{vehicle?.internal_id ?? inspection.id.slice(0, 8)}</strong>
        </div>
      ) : null}

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
        {assessment ? (
          <div className="sipi-vistoria-assessment-grid">
            <p>
              <strong>Produto de furto ou roubo:</strong> {answerLabel(assessment.stolen_or_robbed)}
            </p>
            <p>
              <strong>Submetido ao OBD:</strong> {answerLabel(assessment.obd_examined)}
            </p>
            <p>
              <strong>Periciado:</strong> {answerLabel(assessment.expert_examined)}
            </p>
            <p>
              <strong>Adulteração constatada:</strong> {answerLabel(assessment.tampering_confirmed)}
            </p>
          </div>
        ) : null}
        {assessment?.divergence_indicators?.length ? (
          <div className="sipi-vistoria-result">
            <strong>Indícios de divergência selecionados</strong>
            <ul>
              {assessment.divergence_indicators.map((indicator) => (
                <li key={indicator}>{DIVERGENCE_LABELS[indicator] ?? indicator}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {!results.length ? (
          <p className="sipi-vistoria-narrative">
            Não foram registradas constatações técnicas adicionais.
          </p>
        ) : null}
      </section>

      <section className="sipi-vistoria-block sipi-vistoria-conclusion">
        <h2>7. CONCLUSÃO TÉCNICA</h2>
        <div>
          <span>Resultado consolidado</span>
          <p>
            {findings.result?.trim() ||
              technicalConclusion ||
              "Não foi registrada conclusão técnica adicional para esta versão da vistoria."}
          </p>
        </div>
        {findings.measures_taken?.trim() ? (
          <div>
            <span>Providências adotadas</span>
            <p>{findings.measures_taken}</p>
          </div>
        ) : null}
      </section>

      {answeredQuestionnaire.length ? (
        <section className="sipi-vistoria-block sipi-vistoria-administrative">
          <h2>8. SITUAÇÃO ADMINISTRATIVA E DESTINAÇÃO</h2>
          <div>
            {answeredQuestionnaire.map(([key, value]) => (
              <p key={key}>
                <span>{QUESTIONNAIRE_LABELS[key] ?? key}</span>
                <strong>{answerLabel(value)}</strong>
              </p>
            ))}
          </div>
        </section>
      ) : null}

      <section className="sipi-vistoria-block">
        <h2>{8 + administrativeOffset}. DADOS DO VEÍCULO ORIGINAL / REFERÊNCIA</h2>
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
          <h2>{9 + administrativeOffset}. CUSTÓDIA E DESTINO</h2>
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
          <h2>{10 + administrativeOffset}. PESSOAS VINCULADAS</h2>
          {inspection.linked_people?.length ? (
            inspection.linked_people.map((person) => <p key={person}>{person}</p>)
          ) : (
            <p>Não informado</p>
          )}
        </div>
      </section>

      <section className="sipi-vistoria-block sipi-vistoria-traceability">
        <h2>{11 + administrativeOffset}. RASTREABILIDADE DO REGISTRO</h2>
        <dl>
          <div>
            <dt>Identificador do relatório</dt>
            <dd>{inspection.id}</dd>
          </div>
          <div>
            <dt>Versão</dt>
            <dd>{inspection.current_version}</dd>
          </div>
          <div>
            <dt>Criado em</dt>
            <dd>{formatDateTime(inspection.created_at)}</dd>
          </div>
          <div>
            <dt>Última atualização</dt>
            <dd>{formatDateTime(inspection.updated_at)}</dd>
          </div>
          <div className="is-wide">
            <dt>SHA-256 do PDF assinado</dt>
            <dd>{inspection.pdf_sha256 || "Não registrado nesta versão"}</dd>
          </div>
        </dl>
      </section>

      <section className="sipi-vistoria-block sipi-vistoria-place-date">
        <h2>{12 + administrativeOffset}. LOCAL E DATA</h2>
        <p>
          {displayValue(inspection.location)},{" "}
          {formatInspectionDate(inspection.inspection_date, true)}
        </p>
      </section>

      <section className="sipi-vistoria-block sipi-vistoria-signature">
        <h2>{13 + administrativeOffset}. RESPONSÁVEL PELO REGISTRO</h2>
        <div>
          <span>____________________________________________</span>
          <strong>Servidor responsável</strong>
          <small>Identificação funcional preservada na trilha de auditoria do SIED</small>
        </div>
      </section>

      <footer className="sipi-vistoria-footer">
        <span>SIED - Polícia Civil da Bahia</span>
        <span>Documento operacional de uso interno e restrito</span>
        <span>
          Versão {inspection.current_version} · {photos.length} evidência(s)
        </span>
      </footer>
    </div>
  );
}
