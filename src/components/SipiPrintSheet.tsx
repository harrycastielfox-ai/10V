import { useEffect, useMemo, useState } from "react";

export type SipiPrintField = {
  id?: string;
  label: string;
  value?: string | null;
  wide?: boolean;
  manualLine?: boolean;
};

export type SipiPrintSection = {
  id?: string;
  title: string;
  fields: SipiPrintField[];
  wide?: boolean;
  narrative?: boolean;
  signatures?: boolean;
  pageBreakBefore?: boolean;
  breakable?: boolean;
};

type SipiPrintSheetProps = {
  documentTitle: string;
  documentSubtitle: string;
  identifierLabel: string;
  identifier: string;
  variant?: "default" | "inquiry" | "dossier" | "vehicle" | "term" | "summary";
  summary?: SipiPrintField[];
  sections: SipiPrintSection[];
};

function isPrintableValue(value?: string | null) {
  const normalized = (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  return (
    Boolean(normalized) &&
    !["-", "—", "nao informado", "sem informacao", "selecione"].includes(normalized)
  );
}

export function SipiPrintSheet({
  documentTitle,
  documentSubtitle,
  identifierLabel,
  identifier,
  variant = "default",
  summary = [],
  sections,
}: SipiPrintSheetProps) {
  const [generatedAt, setGeneratedAt] = useState("");

  useEffect(() => {
    setGeneratedAt(
      new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "medium",
      }).format(new Date()),
    );
  }, []);

  const visibleSummary = useMemo(
    () => summary.filter((field) => isPrintableValue(field.value)),
    [summary],
  );

  const visibleSections = useMemo(
    () =>
      sections
        .map((section) => ({
          ...section,
          fields: section.fields.filter(
            (field) => isPrintableValue(field.value) || field.manualLine,
          ),
        }))
        .filter((section) => section.fields.length > 0),
    [sections],
  );

  return (
    <div className={`print-only sipi-print-sheet sipi-print-sheet-${variant}`} aria-hidden="true">
      <header className="sipi-print-masthead">
        <img className="sipi-print-logo" src="/sied-mark.svg" alt="" />
        <div className="sipi-print-heading">
          <p className="sipi-print-agency">Polícia Civil da Bahia</p>
          <h1>{documentTitle}</h1>
          <p>{documentSubtitle}</p>
          <small>SIED - Sistema Integrado de Evidências e Dados</small>
        </div>
        <div className="sipi-print-identifier">
          <span>{identifierLabel}</span>
          <strong>{identifier}</strong>
          <small>{generatedAt ? `Emitido em ${generatedAt}` : "Emitido pelo SIED"}</small>
        </div>
      </header>

      <div className="sipi-print-classification">
        <span>Documento operacional</span>
        <strong>Uso interno e restrito</strong>
      </div>

      {visibleSummary.length > 0 ? (
        <section className="sipi-print-summary">
          {visibleSummary.map((field) => (
            <div key={field.label}>
              <span>{field.label}</span>
              <strong>{field.value}</strong>
            </div>
          ))}
        </section>
      ) : null}

      <main className="sipi-print-sections">
        {visibleSections.map((section) => (
          <section
            key={section.id ?? section.title}
            className={`sipi-print-section${section.wide ? " sipi-print-section-wide" : ""}${section.narrative ? " sipi-print-section-flow" : ""}${section.signatures ? " sipi-print-section-signatures" : ""}${section.pageBreakBefore ? " sipi-print-section-page-break" : ""}${section.breakable ? " sipi-print-section-breakable" : ""}`}
          >
            <h2>{section.title}</h2>
            <dl className={section.narrative ? "sipi-print-narrative-list" : ""}>
              {section.fields.map((field) => (
                <div
                  key={field.id ?? `${section.id ?? section.title}-${field.label}`}
                  className={`${field.wide ? "sipi-print-field-wide" : ""}${field.manualLine ? " sipi-print-field-manual" : ""}`.trim()}
                >
                  <dt>{field.label}</dt>
                  <dd>{field.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </main>

      <footer className="sipi-print-footer">
        <span>SIED - Polícia Civil da Bahia</span>
        <span>Documento confidencial - acesso e tratamento sujeitos à auditoria</span>
      </footer>
    </div>
  );
}
