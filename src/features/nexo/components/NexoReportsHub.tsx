import {
  ArrowUpRight,
  Building2,
  FileText,
  Image,
  Search,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { getNexoPersonPhotoUrl } from "../nexoSelectors";
import { normalizeNexoSearch } from "../nexoWorkspaceSearch";
import type { NexoOrganizacao, NexoPessoa, NexoReportScope } from "../nexoTypes";

export function NexoReportsHub({
  organizations,
  people,
  busy,
  onConfigure,
}: {
  organizations: NexoOrganizacao[];
  people: NexoPessoa[];
  busy: boolean;
  onConfigure: (scope: NexoReportScope) => void;
}) {
  const [query, setQuery] = useState("");
  const needle = normalizeNexoSearch(query);
  const filteredOrganizations = useMemo(
    () =>
      organizations.filter((org) =>
        normalizeNexoSearch(`${org.nome} ${org.sigla || ""}`).includes(needle),
      ),
    [organizations, needle],
  );
  const filteredPeople = useMemo(
    () =>
      people.filter((person) =>
        normalizeNexoSearch(`${person.nome} ${person.apelido || ""}`).includes(needle),
      ),
    [people, needle],
  );

  return (
    <section className="pb-14 pt-8 sm:pt-10">
      <div className="nexo-page-heading">
        <div>
          <p className="nexo-eyebrow">Documentação analítica</p>
          <h1 className="nexo-title mt-2">Relatórios do seu jeito</h1>
          <p className="nexo-description mt-2 max-w-3xl">
            Defina o recorte, escolha o que incluir e revise fotografias e legendas. A configuração
            vale para esta emissão e não altera o dossiê.
          </p>
        </div>
        <span className="hidden shrink-0 items-center gap-2 rounded-xl border border-[#d7e5ed] bg-white px-3.5 py-2.5 text-[11px] font-semibold text-[#567184] sm:inline-flex">
          <FileText className="h-4 w-4 text-[#168aa1]" aria-hidden /> Impressão ou PDF
        </span>
      </div>
      <div className="relative mt-6 isolate overflow-hidden rounded-[24px] border border-[#234d62] bg-[#12334a] text-white shadow-[0_16px_42px_-24px_#12334a80]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-[.06] [background-image:linear-gradient(#9edbe3_1px,transparent_1px),linear-gradient(90deg,#9edbe3_1px,transparent_1px)] [background-size:34px_34px] [mask-image:linear-gradient(90deg,transparent,black)]"
        />
        <button
          type="button"
          onClick={() => onConfigure({ kind: "geral" })}
          disabled={busy}
          className="group relative flex min-h-[174px] w-full items-center gap-4 p-6 text-left transition hover:bg-white/[.035] focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[#95dce7] disabled:opacity-50 sm:gap-5 sm:p-8"
        >
          <span className="hidden rounded-2xl border border-[#8dd2de]/20 bg-[#9adce5]/10 p-4 sm:block">
            <SlidersHorizontal className="h-7 w-7 text-[#9ce4ec]" />
          </span>
          <span className="min-w-0 flex-1 lg:pr-44">
            <span className="mb-2.5 block text-[11px] font-semibold uppercase tracking-[.18em] text-[#9fdce5]">
              Um documento, o seu recorte
            </span>
            <strong className="block text-xl font-extrabold tracking-[-.025em] sm:text-[23px]">
              {busy ? "Preparando dados do relatório…" : "Configurar relatório geral"}
            </strong>
            <span className="mt-2 block max-w-lg text-sm leading-6 text-[#c2d8e2]">
              Pessoas, facções, vínculos, procedimentos, locais e observações.
            </span>
            <span className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#a3e5eb] px-3 py-2 text-xs font-bold text-[#12334a]">
              Escolher conteúdo{" "}
              <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </span>
          </span>
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-[-15px] right-12 top-8 hidden w-[142px] rotate-[7deg] rounded-t-xl border border-[#b5d5e0]/40 bg-[#eff6f9] p-4 shadow-[-12px_10px_0_#ffffff0b] lg:block"
          >
            <span className="flex items-center justify-between border-b border-[#c9dfe8] pb-3">
              <span className="h-3 w-8 rounded-sm bg-[#12334a]" />
              <span className="h-3.5 w-3.5 rounded bg-[#87c7d4]" />
            </span>
            <span className="mt-4 block h-2 w-20 rounded-sm bg-[#315b72]" />
            <span className="mt-2 block h-1.5 w-full rounded-sm bg-[#c0d3de]" />
            <span className="mt-2 block h-1.5 w-4/5 rounded-sm bg-[#c0d3de]" />
            <span className="mt-4 grid grid-cols-2 gap-2">
              <span className="h-12 rounded bg-[#d7e9ef]" />
              <span className="h-12 rounded bg-[#e0ebf1]" />
            </span>
          </span>
          <ArrowUpRight className="h-5 w-5 shrink-0 text-[#a7d8e3] lg:hidden" />
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-[#668598]">
        {[
          { icon: FileText, label: "Seções selecionáveis" },
          { icon: Image, label: "Fotos e legendas por imagem" },
          { icon: SlidersHorizontal, label: "Impressão ou salvar como PDF" },
        ].map(({ icon: Icon, label }) => (
          <span
            key={label}
            className="inline-flex items-center gap-2 rounded-lg border border-[#d9e6ed] bg-white px-3 py-2 text-[#567184]"
          >
            <Icon className="h-3.5 w-3.5 text-[#4a96aa]" />
            {label}
          </span>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap items-end justify-between gap-4 border-b border-[#dce6ed] pb-5">
        <div>
          <h2 className="text-[17px] font-extrabold tracking-[-.02em] text-[#12334a]">
            Relatórios por dossiê
          </h2>
          <p className="mt-1 text-xs leading-5 text-[#567184]">
            Escolha uma facção ou pessoa para configurar uma emissão individual.
          </p>
        </div>
        <label className="relative block w-full sm:max-w-[360px]">
          <Search aria-hidden className="absolute left-3.5 top-3.5 h-4 w-4 text-[#668da1]" />
          <span className="sr-only">Buscar pessoa ou facção para relatório</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar pessoa, alcunha ou facção…"
            className="min-h-11 w-full rounded-xl border border-[#ccdfe8] bg-white py-3 pl-10 pr-4 text-xs text-[#23465d] outline-none transition placeholder:text-[#698599] focus:border-[#168aa1] focus:ring-2 focus:ring-[#168aa1]/15"
          />
        </label>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="nexo-surface overflow-hidden rounded-[22px]">
          <div className="flex items-center gap-3 border-b border-[#e4edf2] px-5 py-4">
            <span className="rounded-lg bg-[#eaf4f7] p-2">
              <Building2 className="h-4 w-4 text-[#168aa1]" />
            </span>
            <h2 className="flex-1 text-sm font-bold text-[#264c64]">Por facção</h2>
            <span className="rounded-md bg-[#eff4f7] px-2 py-1 text-[11px] font-semibold tabular-nums text-[#567184]">
              {filteredOrganizations.length}
            </span>
          </div>
          <div className="max-h-[420px] space-y-2 overflow-y-auto p-4">
            {filteredOrganizations.map((org) => (
              <button
                type="button"
                key={org.id}
                disabled={busy}
                onClick={() => onConfigure({ kind: "organizacao", organizacaoId: org.id })}
                className="group flex min-h-[74px] w-full items-center gap-3 rounded-xl border border-[#e0eaf0] p-3 text-left transition hover:border-[#a7cbd6] hover:bg-[#f5fafb] disabled:opacity-50"
              >
                <span
                  className="h-9 w-1 shrink-0 rounded-full"
                  style={{ backgroundColor: org.cor }}
                />
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-[13px] font-bold text-[#23465e]">
                    {org.nome}
                  </strong>
                  <span className="mt-1 block text-[11px] text-[#567184]">
                    {org.sigla || "Sem sigla"} · configurar seções
                  </span>
                </span>
                <ArrowUpRight className="h-4 w-4 text-[#789cab] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#168aa1]" />
              </button>
            ))}
            {!filteredOrganizations.length ? (
              <p className="nexo-empty-state py-8 text-center text-xs text-[#567184]">
                {organizations.length
                  ? "Nenhuma facção corresponde à busca."
                  : "Nenhuma facção cadastrada."}
              </p>
            ) : null}
          </div>
        </section>
        <section className="nexo-surface overflow-hidden rounded-[22px]">
          <div className="flex items-center gap-3 border-b border-[#e4edf2] px-5 py-4">
            <span className="rounded-lg bg-[#eaf4f7] p-2">
              <UserRound className="h-4 w-4 text-[#168aa1]" />
            </span>
            <h2 className="flex-1 text-sm font-bold text-[#264c64]">Por pessoa</h2>
            <span className="rounded-md bg-[#eff4f7] px-2 py-1 text-[11px] font-semibold tabular-nums text-[#567184]">
              {filteredPeople.length}
            </span>
          </div>
          <div className="max-h-[420px] space-y-2 overflow-y-auto p-4">
            {filteredPeople.map((person) => (
              <button
                type="button"
                key={person.id}
                disabled={busy}
                onClick={() => onConfigure({ kind: "pessoa", pessoaId: person.id })}
                className="group flex min-h-[74px] w-full items-center gap-3 rounded-xl border border-[#e0eaf0] p-3 text-left transition hover:border-[#a7cbd6] hover:bg-[#f5fafb] disabled:opacity-50"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#dbe8ee] bg-[#edf5f8]">
                  {getNexoPersonPhotoUrl(person) ? (
                    <img
                      src={getNexoPersonPhotoUrl(person)!}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UserRound className="h-4 w-4 text-[#51889f]" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-[13px] font-bold text-[#23465e]">
                    {person.nome}
                  </strong>
                  <span className="mt-1 block text-[11px] text-[#567184]">
                    {person.apelido || "Sem alcunha"} · configurar seções
                  </span>
                </span>
                <ArrowUpRight className="h-4 w-4 text-[#789cab] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#168aa1]" />
              </button>
            ))}
            {!filteredPeople.length ? (
              <p className="nexo-empty-state py-8 text-center text-xs text-[#567184]">
                {people.length
                  ? "Nenhuma pessoa corresponde à busca."
                  : "Nenhuma pessoa cadastrada."}
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </section>
  );
}
