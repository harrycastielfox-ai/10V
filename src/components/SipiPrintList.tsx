type SipiPrintListProps = {
  documentTitle: string;
  documentSubtitle: string;
  filtrosAplicados: { label: string; value: string }[];
  columns: { id: string; label: string; align?: "left" | "center" | "right" }[];
  rows: string[][];
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
        <img className="sipi-print-logo" src="/sipi-logo.png" alt="" />
        <div className="sipi-print-heading">
          <p className="sipi-print-agency">Polícia Civil da Bahia</p>
          <h1>{documentTitle}</h1>
          <p>{documentSubtitle}</p>
          <small>SIPI - Sistema de Inquéritos Policiais</small>
        </div>
        <div className="sipi-print-identifier">
          <span>Total filtrado</span>
          <strong>{total}</strong>
          <small>Emitido em {geradoEm}</small>
        </div>
      </header>

      <div className="sipi-print-classification">
        <span>Consulta operacional</span>
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
                  {filter.label}: {filter.value}
                </li>
              ))}
            </ul>
          ) : (
            <span> Nenhum — consulta completa</span>
          )}
        </div>
      </section>

      <table className="sipi-print-list-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.id} className={`is-${column.align ?? "left"}`}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((value, columnIndex) => (
                <td
                  key={`${rowIndex}-${columns[columnIndex]?.id ?? columnIndex}`}
                  className={`is-${columns[columnIndex]?.align ?? "left"}`}
                >
                  {value || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <footer className="sipi-print-footer">
        <span>SIPI - Polícia Civil da Bahia</span>
        <span>Documento confidencial - acesso e tratamento sujeitos à auditoria</span>
      </footer>
    </div>
  );
}
