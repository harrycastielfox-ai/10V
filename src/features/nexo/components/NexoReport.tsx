import type {
  NexoOrganizacao,
  NexoObservacao,
  NexoPessoa,
  NexoRegistroVinculado,
  NexoReportScope,
  NexoTerritorio,
  NexoVinculoStatus,
} from "../nexoTypes";
import {
  groupNexoReportProcedures,
  normalizeNexoReportConfig,
  selectedNexoReportPhotos,
  selectedNexoReportSources,
  selectNexoReportData,
  type NexoReportConfig,
} from "../nexoReportConfig";

const STATUS_LABEL: Record<NexoVinculoStatus, string> = {
  confirmado: "Confirmado",
  provavel: "Provável",
  suspeito: "Suspeito",
  nao_confirmado: "Não confirmado",
  desvinculado: "Desvinculado",
};

function value(input: string | null | undefined) {
  return input?.trim() || "Não informado";
}

function formatDate(input: string | null | undefined) {
  if (!input) return "Não informada";
  const date = new Date(`${input.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.valueOf()) ? input : new Intl.DateTimeFormat("pt-BR").format(date);
}

function ObservationEntries({ observations }: { observations: NexoObservacao[] }) {
  return observations.map((observation) => (
    <div key={observation.id} className="nexo-report-link">
      <p style={{ whiteSpace: "pre-wrap" }}>{observation.conteudo}</p>
      <small>
        {Number.isFinite(Date.parse(observation.created_at))
          ? new Intl.DateTimeFormat("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
              timeZone: "America/Sao_Paulo",
            }).format(new Date(observation.created_at))
          : "Data não informada"}
        {observation.autor?.nome ? ` · ${observation.autor.nome}` : ""}
      </small>
    </div>
  ));
}

function PersonReport({
  pessoa,
  registros,
  scope,
  config,
  observacoes,
}: {
  pessoa: NexoPessoa;
  registros: NexoRegistroVinculado[];
  scope: NexoReportScope;
  config: NexoReportConfig;
  observacoes: NexoObservacao[];
}) {
  const links = pessoa.vinculos.filter(
    (link) => scope.kind !== "organizacao" || link.organizacao_id === scope.organizacaoId,
  );
  const mainLink = links.find((link) => link.status !== "desvinculado");
  const personRecords = groupNexoReportProcedures(
    registros.filter((item) => item.pessoa_id === pessoa.id),
  );
  const photos = selectedNexoReportPhotos(pessoa, config);
  const sources = selectedNexoReportSources(pessoa, config);
  const mainPhoto = photos.find((photo) => photo.kind === "principal");
  const album = photos.filter((photo) => photo.kind !== "principal");
  const personObservations = observacoes.filter(
    (observation) => observation.pessoa_id === pessoa.id,
  );
  return (
    <article className="nexo-report-person">
      <div
        className={`nexo-report-person-hero${mainPhoto ? "" : " nexo-report-person-hero-no-photo"}`}
      >
        {mainPhoto ? (
          <figure style={{ margin: 0, maxWidth: "32mm" }}>
            <div className="nexo-report-person-photo">
              <img src={mainPhoto.url} alt={`Fotografia de referência de ${pessoa.nome}`} />
            </div>
            {mainPhoto.caption ? (
              <figcaption style={{ fontSize: "7pt", marginTop: "2mm", whiteSpace: "pre-wrap" }}>
                {mainPhoto.caption}
              </figcaption>
            ) : null}
          </figure>
        ) : null}
        <div>
          <small>FICHA INDIVIDUAL DE INTELIGÊNCIA</small>
          <h2>{pessoa.nome}</h2>
          {config.sections.identification ? (
            <p>
              {pessoa.apelido ? `Conhecido(a) como “${pessoa.apelido}”` : "Sem alcunha informada"}
            </p>
          ) : null}
          {config.sections.links ? (
            <strong>
              {mainLink
                ? STATUS_LABEL[mainLink.status]
                : links.length
                  ? "Somente vínculos históricos neste recorte"
                  : "Sem vínculo cadastrado"}
            </strong>
          ) : null}
        </div>
      </div>
      {config.sections.identification ? (
        <section className="nexo-report-section">
          <h3>Dados de identificação</h3>
          <dl className="nexo-report-grid">
            <div>
              <dt>Nome completo</dt>
              <dd>{pessoa.nome}</dd>
            </div>
            <div>
              <dt>Apelido</dt>
              <dd>{value(pessoa.apelido)}</dd>
            </div>
            <div>
              <dt>CPF</dt>
              <dd>{value(pessoa.cpf)}</dd>
            </div>
            <div>
              <dt>RG</dt>
              <dd>{value(pessoa.rg)}</dd>
            </div>
            <div>
              <dt>{pessoa.idade_aproximada ? "Idade estimada" : "Nascimento"}</dt>
              <dd>
                {pessoa.idade_aproximada
                  ? pessoa.idade_aproximada_valor != null
                    ? `${pessoa.idade_aproximada_valor} anos`
                    : "Não informada"
                  : formatDate(pessoa.data_nascimento)}
              </dd>
            </div>
            <div>
              <dt>Naturalidade</dt>
              <dd>{value(pessoa.naturalidade)}</dd>
            </div>
            <div>
              <dt>Filiação materna</dt>
              <dd>{value(pessoa.nome_mae)}</dd>
            </div>
            <div>
              <dt>Filiação paterna</dt>
              <dd>{value(pessoa.nome_pai)}</dd>
            </div>
            <div>
              <dt>Telefone</dt>
              <dd>{value(pessoa.telefone)}</dd>
            </div>
            <div>
              <dt>Nome social</dt>
              <dd>{value(pessoa.nome_social)}</dd>
            </div>
            <div>
              <dt>Sexo / raça-cor</dt>
              <dd>
                {[pessoa.sexo, pessoa.raca_cor].filter(Boolean).join(" · ") || "Não informado"}
              </dd>
            </div>
            <div>
              <dt>Estado civil</dt>
              <dd>{value(pessoa.estado_civil)}</dd>
            </div>
            <div>
              <dt>Nacionalidade</dt>
              <dd>{value(pessoa.nacionalidade)}</dd>
            </div>
            <div>
              <dt>Escolaridade / profissão</dt>
              <dd>
                {[pessoa.escolaridade, pessoa.profissao].filter(Boolean).join(" · ") ||
                  "Não informado"}
                {pessoa.profissao_desatualizada ? " · Possivelmente desatualizado/Antigo" : ""}
              </dd>
            </div>
            <div>
              <dt>Identificação visual</dt>
              <dd>
                {[
                  pessoa.tipo_fisico,
                  pessoa.altura_cm ? `${pessoa.altura_cm} cm` : null,
                  pessoa.sinais_particulares,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Não informado"}
              </dd>
            </div>
          </dl>
          {pessoa.documentos_extras?.length ? (
            <p>
              <b>Documentos adicionais:</b>{" "}
              {pessoa.documentos_extras
                .map((item) => `${item.tipo}: ${item.numero || "sem número"}`)
                .join("; ")}
            </p>
          ) : null}
          {pessoa.contatos?.length ? (
            <p>
              <b>Contatos:</b>{" "}
              {pessoa.contatos
                .map(
                  (item) =>
                    `${item.tipo}: ${item.valor || "não informado"}${item.whatsapp ? " (WhatsApp)" : ""}${item.desatualizado ? " (Possivelmente desatualizado/Antigo)" : ""}`,
                )
                .join("; ")}
            </p>
          ) : null}
        </section>
      ) : null}
      {config.sections.links ? (
        <section className="nexo-report-section">
          <h3>Vínculos avaliados</h3>
          {links.length ? (
            links.map((vinculo) => (
              <div className="nexo-report-link" key={vinculo.id}>
                <div>
                  <strong>{vinculo.organizacao?.nome || "Organização não identificada"}</strong>
                  <span>
                    {STATUS_LABEL[vinculo.status]} · confiança {vinculo.confianca}%
                  </span>
                </div>
                <p>
                  {value(vinculo.funcao)} — {value(vinculo.fonte_resumo)}
                </p>
              </div>
            ))
          ) : (
            <p>Nenhum vínculo cadastrado.</p>
          )}
        </section>
      ) : null}
      {sources.length ? (
        <section className="nexo-report-section">
          <h3>Fontes documentais selecionadas</h3>
          <table>
            <thead>
              <tr>
                <th>Documento</th>
                <th>Origem</th>
                <th>Hash SHA-256</th>
                <th>Páginas</th>
                <th>Extração</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => (
                <tr key={source.key}>
                  <td>
                    {source.filename}
                    {source.observation?.trim() ? (
                      <small style={{ display: "block", marginTop: "1mm" }}>
                        Observação: {source.observation}
                      </small>
                    ) : null}
                  </td>
                  <td>{source.kind === "recurso" ? "Recurso anexado" : "PDF de origem"}</td>
                  <td>{source.sha256 || "Não informado"}</td>
                  <td>{source.pageCount ?? "Não informado"}</td>
                  <td>{source.extraction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
      {config.sections.procedures ? (
        <section className="nexo-report-section">
          <h3>B.O. e procedimentos vinculados à pessoa</h3>
          {personRecords.length ? (
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Número</th>
                  <th>Situação / natureza</th>
                </tr>
              </thead>
              <tbody>
                {personRecords.map(({ key, record: item }) => (
                  <tr key={key}>
                    <td>{item.inquerito_id ? "Inquérito" : "B.O."}</td>
                    <td>{item.inquerito?.numero_ppe || item.bo?.numero_bo || "Não informado"}</td>
                    <td>
                      {item.inquerito?.situacao || item.bo?.infracao_penal || "Não informado"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>Nenhum B.O. ou procedimento vinculado diretamente a esta pessoa.</p>
          )}
        </section>
      ) : null}
      {config.sections.locations ? (
        <section className="nexo-report-section">
          <h3>Localização e instruções de campo</h3>
          <p>
            {pessoa.endereco
              ? `${pessoa.endereco.logradouro}, ${value(pessoa.endereco.numero)} — ${value(pessoa.endereco.bairro)}, ${pessoa.endereco.municipio}/${pessoa.endereco.uf}`
              : pessoa.usar_local_faccao && mainLink
                ? `Referência territorial do vínculo atual: ${mainLink.organizacao?.area_atuacao || "área não detalhada"}`
                : "Nenhum endereço cadastrado."}
          </p>
          {pessoa.endereco?.ponto_referencia ? (
            <p>
              <b>Referência:</b> {pessoa.endereco.ponto_referencia}
            </p>
          ) : null}
          {pessoa.endereco?.como_chegar ? (
            <p>
              <b>Como chegar:</b> {pessoa.endereco.como_chegar}
            </p>
          ) : null}
          {pessoa.endereco?.link_navegacao ? (
            <p>
              <b>Link de navegação:</b> {pessoa.endereco.link_navegacao}
            </p>
          ) : null}
        </section>
      ) : null}
      {config.sections.observations ? (
        <section className="nexo-report-section">
          <h3>Observações analíticas</h3>
          {!config.excludedObservationKeys.includes(`person:${pessoa.id}`) &&
          pessoa.observacoes?.trim() ? (
            <p style={{ whiteSpace: "pre-wrap" }}>{pessoa.observacoes}</p>
          ) : null}
          <ObservationEntries observations={personObservations} />
        </section>
      ) : null}
      {album.length ? (
        <section className="nexo-report-section nexo-report-album">
          <h3>Registros fotográficos complementares</h3>
          <div>
            {album.map((foto) => (
              <figure key={foto.key}>
                <img src={foto.url} alt={`Fotografia de ${pessoa.nome}`} />
                {foto.caption ? (
                  <figcaption style={{ whiteSpace: "pre-wrap" }}>{foto.caption}</figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}

export function NexoReport({
  scope,
  organizacoes,
  pessoas,
  territorios = [],
  registros = [],
  observacoes = [],
  config,
  screenPreview = false,
}: {
  scope: NexoReportScope | null;
  organizacoes: NexoOrganizacao[];
  pessoas: NexoPessoa[];
  territorios?: NexoTerritorio[];
  registros?: NexoRegistroVinculado[];
  observacoes?: NexoObservacao[];
  config?: NexoReportConfig;
  screenPreview?: boolean;
}) {
  if (!scope) return null;
  const options = normalizeNexoReportConfig(config);
  const selectedData = selectNexoReportData(scope, {
    organizacoes,
    pessoas,
    territorios,
    registros,
    observacoes,
  });
  const org =
    scope.kind === "organizacao"
      ? (organizacoes.find((item) => item.id === scope.organizacaoId) ?? null)
      : null;
  const selectedPeople = selectedData.people;
  const selectedTerritories = selectedData.territories;
  const selectedRecords = selectedData.records;
  const selectedProcedures = groupNexoReportProcedures(selectedRecords);
  const title =
    scope.kind === "geral"
      ? "RELATÓRIO GERAL DE ORGANIZAÇÕES E VÍNCULOS"
      : scope.kind === "organizacao"
        ? `RELATÓRIO ANALÍTICO — ${org?.nome || "ORGANIZAÇÃO"}`
        : "RELATÓRIO INDIVIDUAL DE INTELIGÊNCIA";

  return (
    <div
      className={`${screenPreview ? "nexo-report-preview" : "print-only"} nexo-print-document`}
      aria-hidden={screenPreview ? undefined : true}
    >
      <header className="nexo-report-letterhead">
        <img src="/policia-civil-bahia-brasao-pdf.png" alt="" />
        <div>
          <strong>POLÍCIA CIVIL DA BAHIA</strong>
          <span>23ª COORDENADORIA REGIONAL DE POLÍCIA</span>
          <span>DELEGACIA TERRITORIAL DE ITABELA</span>
          <small>NEXO · Núcleo Estratégico de Vínculos e Organizações</small>
        </div>
        <aside>
          <span>CLASSIFICAÇÃO</span>
          <strong>USO RESTRITO</strong>
          <small>
            {new Intl.DateTimeFormat("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
              timeZone: "America/Sao_Paulo",
            }).format(new Date())}
          </small>
        </aside>
      </header>
      <div className="nexo-report-title">
        <span>{title}</span>
        <strong>SIED / NEXO</strong>
      </div>
      <div className="nexo-report-disclaimer">
        Informações conforme os registros disponíveis no NEXO. Dados não informados não devem ser
        interpretados como negativos. Menções e vínculos não confirmados não equivalem a imputação
        ou prova; consulte a fonte registrada para avaliar cada informação.
      </div>
      {scope.kind !== "pessoa" && (options.sections.identification || options.sections.links) ? (
        <section className="nexo-report-summary">
          <div>
            <span>Organizações</span>
            <strong>{scope.kind === "geral" ? organizacoes.length : org ? 1 : 0}</strong>
          </div>
          <div>
            <span>Pessoas relacionadas</span>
            <strong>{selectedPeople.length}</strong>
          </div>
          {options.sections.links ? (
            <div>
              <span>Vínculos confirmados</span>
              <strong>
                {
                  selectedPeople
                    .flatMap((p) => p.vinculos)
                    .filter(
                      (v) =>
                        v.status === "confirmado" &&
                        (scope.kind !== "organizacao" || v.organizacao_id === scope.organizacaoId),
                    ).length
                }
              </strong>
            </div>
          ) : null}
          {options.sections.links ? (
            <div>
              <span>Em validação</span>
              <strong>
                {
                  selectedPeople
                    .flatMap((p) => p.vinculos)
                    .filter(
                      (v) =>
                        ["provavel", "suspeito", "nao_confirmado"].includes(v.status) &&
                        (scope.kind !== "organizacao" || v.organizacao_id === scope.organizacaoId),
                    ).length
                }
              </strong>
            </div>
          ) : null}
        </section>
      ) : null}
      {scope.kind === "organizacao" && options.sections.links ? (
        <p className="nexo-report-disclaimer">
          O recorte inclui vínculos atuais e históricos. Pessoas desvinculadas são identificadas
          como histórico; sua presença no relatório não indica participação atual.
        </p>
      ) : null}
      {scope.kind === "geral" && options.sections.identification ? (
        <section className="nexo-report-section">
          <h3>Quadro geral das organizações</h3>
          <table>
            <thead>
              <tr>
                <th>Organização</th>
                <th>Status</th>
                <th>Risco</th>
                {options.sections.locations ? <th>Área de atuação</th> : null}
                {options.sections.links ? <th>Pessoas com vínculo atual</th> : null}
              </tr>
            </thead>
            <tbody>
              {organizacoes.map((item) => (
                <tr key={item.id}>
                  <td>
                    <b>{item.nome}</b>
                    {item.sigla ? ` (${item.sigla})` : ""}
                  </td>
                  <td>{item.status}</td>
                  <td>{item.nivel_risco}</td>
                  {options.sections.locations ? <td>{value(item.area_atuacao)}</td> : null}
                  {options.sections.links ? (
                    <td>
                      {
                        pessoas.filter((p) =>
                          p.vinculos.some(
                            (v) => v.organizacao_id === item.id && v.status !== "desvinculado",
                          ),
                        ).length
                      }
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
      {org && options.sections.identification ? (
        <section className="nexo-report-section">
          <h3>Síntese da organização</h3>
          <p>
            <b>
              {org.nome}
              {org.sigla ? ` (${org.sigla})` : ""}
            </b>{" "}
            — status {org.status}, risco {org.nivel_risco}.
          </p>
          {options.sections.locations ? (
            <p>
              <b>Área:</b> {value(org.area_atuacao)}
            </p>
          ) : null}
        </section>
      ) : null}
      {scope.kind !== "pessoa" && options.sections.locations ? (
        <section className="nexo-report-section">
          <h3>Quadro territorial cadastrado</h3>
          <p>
            As áreas abaixo são marcações analíticas manuais, não limites oficiais. A classificação
            e a confiança devem ser consideradas junto com a fonte registrada.
          </p>
          {selectedTerritories.length ? (
            <table>
              <thead>
                <tr>
                  <th>Bairro / área</th>
                  <th>Categoria e endereço</th>
                  <th>Organização</th>
                  <th>Classificação</th>
                  <th>Confiança</th>
                  <th>Fundamento informado</th>
                </tr>
              </thead>
              <tbody>
                {selectedTerritories.map((item) => (
                  <tr key={item.id}>
                    <td>{item.bairro}</td>
                    <td>
                      {item.categoria.replaceAll("_", " ")}
                      {item.logradouro
                        ? ` · ${item.logradouro}${item.numero ? `, ${item.numero}` : ""} · ${item.municipio}/${item.uf}`
                        : " · endereço não informado"}
                    </td>
                    <td>
                      {organizacoes.find((entry) => entry.id === item.organizacao_id)?.nome ||
                        "Não identificada"}
                    </td>
                    <td>{item.classificacao.replaceAll("_", " ")}</td>
                    <td>{item.confianca}%</td>
                    <td>{value(item.fonte_resumo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>Nenhuma área cadastrada para este recorte.</p>
          )}
        </section>
      ) : null}
      {scope.kind !== "pessoa" && options.sections.procedures ? (
        <section className="nexo-report-section">
          <h3>Procedimentos vinculados no SIED</h3>
          {selectedProcedures.length ? (
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Número</th>
                  <th>Situação / natureza</th>
                  <th>Vinculado a</th>
                </tr>
              </thead>
              <tbody>
                {selectedProcedures.map(({ key, record: item, links }) => (
                  <tr key={key}>
                    <td>{item.inquerito_id ? "Inquérito" : "B.O."}</td>
                    <td>{item.inquerito?.numero_ppe || item.bo?.numero_bo || "Não informado"}</td>
                    <td>
                      {item.inquerito?.situacao || item.bo?.infracao_penal || "Não informado"}
                    </td>
                    <td>
                      {[
                        ...new Set(
                          links.map((link) =>
                            link.pessoa_id
                              ? pessoas.find((person) => person.id === link.pessoa_id)?.nome ||
                                "Pessoa"
                              : organizacoes.find(
                                  (organization) => organization.id === link.organizacao_id,
                                )?.nome || "Organização",
                          ),
                        ),
                      ].join("; ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>Nenhum procedimento vinculado neste recorte.</p>
          )}
        </section>
      ) : null}
      {scope.kind !== "pessoa" && options.sections.observations ? (
        <section className="nexo-report-section">
          <h3>Observações das organizações</h3>
          {selectedData.organizations.map((organization) =>
            organization.descricao?.trim() &&
            !options.excludedObservationKeys.includes(`organization:${organization.id}`) ? (
              <div key={organization.id}>
                <h4>{organization.nome}</h4>
                <p style={{ whiteSpace: "pre-wrap" }}>{organization.descricao}</p>
              </div>
            ) : null,
          )}
          <ObservationEntries
            observations={selectedData.observations.filter(
              (observation) =>
                !observation.pessoa_id &&
                !options.excludedObservationKeys.includes(`note:${observation.id}`),
            )}
          />
          {!selectedData.organizations.some(
            (organization) =>
              organization.descricao?.trim() &&
              !options.excludedObservationKeys.includes(`organization:${organization.id}`),
          ) &&
          !selectedData.observations.some(
            (observation) =>
              !observation.pessoa_id &&
              !options.excludedObservationKeys.includes(`note:${observation.id}`),
          ) ? (
            <p>Nenhuma observação cadastrada neste recorte.</p>
          ) : null}
        </section>
      ) : null}
      {selectedPeople.map((pessoa) => (
        <PersonReport
          key={pessoa.id}
          pessoa={pessoa}
          registros={selectedRecords}
          scope={scope}
          config={options}
          observacoes={selectedData.observations.filter(
            (observation) => !options.excludedObservationKeys.includes(`note:${observation.id}`),
          )}
        />
      ))}
      <footer className="nexo-report-footer">
        <span>Documento gerado pelo SIED · NEXO</span>
        <span>Uso policial restrito · Auditoria ativa</span>
      </footer>
    </div>
  );
}
