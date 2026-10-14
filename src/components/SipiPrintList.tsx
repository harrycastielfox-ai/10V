export type SipiPrintListColumn = {
  id: string;
  label: string;
  align?: "left" | "center" | "right";
  width?: string;
};

export type SipiPrintListRow = {
  id: string;
  cells: string[];
  details: { label: string; value: string }[];
  incomplete?: boolean;
};

type SipiPrintListProps = {
  documentTitle: string;
  documentSubtitle: string;
  filtrosAplicados: { label: string; value: string }[];
  columns: SipiPrintListColumn[];
  rows: SipiPrintListRow[];
  total: number;
  geradoEm: string;
  geradoPor: string;
};

export function SipiPrintList({
  documentTitle,
  documentSubtitle,
  filtrosAplicados,
  columns,
  rows,
  total,
  geradoEm,
  geradoPor,
}: SipiPrintListProps) {
  return (
    <div className="print-only sipi-print-sheet sipi-print-list" aria-hidden="true">
      <header className="sipi-print-masthead">
        <img className="sipi-print-logo" src="/sied-mark.svg?v=2" alt="" />
        <div className="sipi-print-heading">
          <p className="sipi-print-agency">Polícia Civil da Bahia</p>
          <h1>{documentTitle}</h1>
          <p>{documentSubtitle}</p>
          <small>SIED - Sistema Integrado de Evidências e Dados</small>
        </div>
        <div className="sipi-print-identifier">
          <span>Total filtrado</span>
          <strong>{total}</strong>
          <small>Emitido em {geradoEm}</small>
        </div>
      </header>

      <div className="sipi-print-classification">
        <span>Resumo operacional dos filtros</span>
        <strong>Uso interno e restrito</strong>
      </div>

      <section className="sipi-print-list-context">
        <p>
          <strong>Emitido por:</strong> {geradoPor}
        </p>
        <div>
          <strong>Filtros aplicados:</strong>
          {filtrosAplicados.length ? (
            <ul>
              {filtrosAplicados.map((filter) => (
                <li key={`${filter.label}-${filter.value}`}>
                  <strong>{filter.label}:</strong> {filter.value}
                </li>
              ))}
            </ul>
          ) : (
            <span> Nenhum - consulta completa</span>
          )}
        </div>
      </section>

      <table className="sipi-print-list-table">
        <colgroup>
          {columns.map((column) => (
            <col key={column.id} style={column.width ? { width: column.width } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.id} className={`is-${column.align ?? "left"}`}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        {rows.map((row) => (
          <tbody
            className={`sipi-print-list-record${row.incomplete ? " is-incomplete" : ""}`}
            key={row.id}
          >
            <tr className="sipi-print-list-primary-row">
              {row.cells.map((value, columnIndex) => (
                <td
                  key={`${row.id}-${columns[columnIndex]?.id ?? columnIndex}`}
                  className={`is-${columns[columnIndex]?.align ?? "left"}`}
                >
                  {row.incomplete && columns[columnIndex]?.id === "procedimento"
                    ? "Cadastro incompleto"
                    : value || "—"}
                </td>
              ))}
            </tr>
            <tr className="sipi-print-list-detail-row">
              <td colSpan={columns.length}>
                <dl>
                  {row.details.map((detail) => (
                    <div key={`${row.id}-${detail.label}`}>
                      <dt>{detail.label}</dt>
                      <dd>{detail.value || "—"}</dd>
                    </div>
                  ))}
                </dl>
              </td>
            </tr>
          </tbody>
        ))}
      </table>

      <footer className="sipi-print-footer sipi-print-list-footer">
        <span>SIED - Polícia Civil da Bahia</span>
        <span>Documento confidencial - acesso e tratamento sujeitos à auditoria</span>
      </footer>
    </div>
  );
}
