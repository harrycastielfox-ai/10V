import {
  BadgeCheck,
  Building2,
  FileBarChart,
  FileText,
  MapPinned,
  Network,
  Radar,
  Search,
  RefreshCw,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import "../nexoVisual.css";
import { NEXO_PRESENTATION_DATA } from "../nexoPresentationData";
import { createNexoPresentationProcedureRows } from "../nexoPresentationProcedureRows";
import type {
  NexoOrganizacao,
  NexoOrganizacaoInput,
  NexoPessoa,
  NexoPessoaInput,
  NexoRegistroVinculado,
  NexoReportScope,
  NexoTerritorio,
  NexoTerritorioInput,
  NexoVinculoManagementInput,
  NexoHierarquiaEvento,
  NexoObservacao,
} from "../nexoTypes";
import { NexoCreateDialog, type CreateKind } from "../components/NexoCreateDialog";
import { NexoBootSequence } from "../components/NexoBootSequence";
import { NexoCommandDashboard } from "../components/NexoCommandDashboard";
import { NexoCommandPalette } from "../components/NexoCommandPalette";
import { NexoDirectoryPanel } from "../components/NexoDirectoryPanel";
import { NexoDossier } from "../components/NexoDossier";
import { NexoIntelligenceBoard } from "../components/NexoIntelligenceBoard";
import { NexoProceduresDashboard } from "../components/NexoProceduresDashboard";
import type { NexoLinkInput } from "../components/NexoLinkForm";
import { NexoReport } from "../components/NexoReport";
import { NexoRoutesPanel } from "../components/NexoRoutesPanel";
import { NexoReportConfigurator } from "../components/NexoReportConfigurator";
import { NexoReportsHub } from "../components/NexoReportsHub";
import { createNexoReportConfig, type NexoReportConfig } from "../nexoReportConfig";
import type { NexoSearchTarget, NexoWorkspaceView } from "../nexoWorkspaceSearch";
import { previewPersonFromInput } from "./previewPersonFromInput";

type View = NexoWorkspaceView;
type DossierTarget = { kind: "person" | "organization"; id: string };

const VIEWS: { id: View; label: string; icon: typeof MapPinned }[] = [
  { id: "painel", label: "Central", icon: Radar },
  { id: "organizacoes", label: "Facções", icon: Building2 },
  { id: "pessoas", label: "Pessoas", icon: UsersRound },
  { id: "inteligencia", label: "Inteligência", icon: Network },
  { id: "mapa", label: "Rotas", icon: MapPinned },
  { id: "procedimentos", label: "Procedimentos", icon: FileText },
  { id: "relatorios", label: "Relatórios", icon: FileBarChart },
];

export default function NexoWorkspacePage({ preview = false }: { preview?: boolean }) {
  const [view, setView] = useState<View>("painel");
  const [organizations, setOrganizations] = useState<NexoOrganizacao[]>(
    preview ? NEXO_PRESENTATION_DATA.organizations : [],
  );
  const [people, setPeople] = useState<NexoPessoa[]>(preview ? NEXO_PRESENTATION_DATA.people : []);
  const [previewHierarchyEvents, setPreviewHierarchyEvents] = useState<NexoHierarquiaEvento[]>(
    preview ? NEXO_PRESENTATION_DATA.hierarchyEvents : [],
  );
  const [territories, setTerritories] = useState<NexoTerritorio[]>(
    preview ? NEXO_PRESENTATION_DATA.territories : [],
  );
  const [dossier, setDossier] = useState<DossierTarget | null>(null);
  const [editTarget, setEditTarget] = useState<DossierTarget | null>(null);
  const [createKind, setCreateKind] = useState<CreateKind | null>(null);
  const [createOrganizationId, setCreateOrganizationId] = useState<string | null>(null);
  const [reportScope, setReportScope] = useState<NexoReportScope | null>(null);
  const [configuringReport, setConfiguringReport] = useState<NexoReportScope | null>(null);
  const [reportConfig, setReportConfig] = useState(createNexoReportConfig);
  const [reportNotes, setReportNotes] = useState<NexoObservacao[]>(
    preview ? NEXO_PRESENTATION_DATA.observations : [],
  );
  const [preparingReport, setPreparingReport] = useState(false);
  const [printing, setPrinting] = useState(false);
  const reportBusyRef = useRef(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [reportRecords, setReportRecords] = useState<NexoRegistroVinculado[]>(
    preview ? NEXO_PRESENTATION_DATA.records : [],
  );
  const [loading, setLoading] = useState(!preview);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [booting, setBooting] = useState(true);

  const reload = useCallback(async () => {
    if (preview) return;
    setLoading(true);
    setError("");
    try {
      const [repo, integrations] = await Promise.all([
        import("@/lib/repositories/nexoRepository"),
        import("@/lib/repositories/nexoIntegrationsRepository"),
      ]);
      const [foundOrganizations, foundPeople, foundTerritories, foundRecords] = await Promise.all([
        repo.listNexoOrganizacoes(),
        repo.listNexoPessoas(),
        repo.listNexoTerritorios(),
        integrations.listNexoRegistrosVinculados(),
      ]);
      setOrganizations(foundOrganizations);
      setPeople(foundPeople);
      setTerritories(foundTerritories);
      setReportRecords(foundRecords);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar o NEXO.");
    } finally {
      setLoading(false);
    }
  }, [preview]);

  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    const timeout = window.setTimeout(() => setBooting(false), 2100);
    return () => window.clearTimeout(timeout);
  }, []);
  useEffect(() => {
    const sync = () => {
      const hash = window.location.hash.slice(1) as View;
      if (VIEWS.some((item) => item.id === hash)) setView(hash);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const duration = notice.includes("fotografia ficou pendente") ? 8000 : 3500;
    const timeout = window.setTimeout(() => setNotice(""), duration);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const workspaceData = useMemo(
    () => ({ organizations, people, territories, records: reportRecords }),
    [organizations, people, territories, reportRecords],
  );
  const presentationProcedureRows = useMemo(
    () =>
      preview
        ? createNexoPresentationProcedureRows(organizations, people, reportRecords)
        : undefined,
    [preview, organizations, people, reportRecords],
  );

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        // Keep the active form's focus trap intact.
        if (createKind || configuringReport || dossier || booting) return;
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [createKind, configuringReport, dossier, booting]);

  function startCreate(kind: CreateKind) {
    setEditTarget(null);
    setCreateOrganizationId(null);
    setCreateKind(kind);
  }

  function openDossier(target: DossierTarget) {
    setDossier(target);
  }

  function chooseSearchResult(target: NexoSearchTarget) {
    if (target.kind === "view") navigateTo(target.view);
    else if (target.kind === "territory")
      openDossier({ kind: "organization", id: target.organizationId });
    else if (target.kind === "procedure") {
      window.location.assign(
        target.type === "bo"
          ? `/bo/${encodeURIComponent(target.id)}`
          : `/inqueritos/${encodeURIComponent(target.id)}`,
      );
    } else openDossier(target);
  }

  async function prepareReport(scope: NexoReportScope) {
    if (reportBusyRef.current) return;
    reportBusyRef.current = true;
    setPreparingReport(true);
    setError("");
    try {
      if (!preview) {
        const repo = await import("@/lib/repositories/nexoIntegrationsRepository");
        const [records, notes] = await Promise.all([
          repo.listNexoRegistrosVinculados(),
          repo.listNexoObservacoesForReport(),
        ]);
        setReportRecords(records);
        setReportNotes(notes);
      }
      setConfiguringReport(scope);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível preparar os dados do relatório.",
      );
      setNotice("Falha ao preparar o relatório. Consulte a mensagem de erro.");
    } finally {
      reportBusyRef.current = false;
      setPreparingReport(false);
    }
  }

  async function generateReport(scope: NexoReportScope, config: NexoReportConfig) {
    if (reportBusyRef.current) return;
    reportBusyRef.current = true;
    setPrinting(true);
    try {
      flushSync(() => {
        setReportConfig(config);
        setReportScope(scope);
      });
      // Commit the selected print DOM, then let selected images finish loading.
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      const images = [...document.querySelectorAll<HTMLImageElement>(".nexo-print-document img")];
      const readiness = await Promise.race([
        Promise.all(
          images.map((image) =>
            image.complete ? Promise.resolve() : image.decode().catch(() => undefined),
          ),
        ).then(() => true),
        new Promise<false>((resolve) => window.setTimeout(() => resolve(false), 8_000)),
      ]);
      if (!readiness || images.some((image) => image.naturalWidth === 0)) {
        setNotice("Uma fotografia não carregou. Revise as imagens antes de imprimir.");
        return;
      }
      window.print();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Não foi possível abrir a impressão.");
    } finally {
      setPrinting(false);
      setReportScope(null);
      reportBusyRef.current = false;
    }
  }

  async function closeDossier() {
    setDossier(null);
    if (preview) return;
    try {
      const repo = await import("@/lib/repositories/nexoIntegrationsRepository");
      setReportRecords(await repo.listNexoRegistrosVinculados());
    } catch {
      setError("Não foi possível atualizar os vínculos de procedimentos. Use Atualizar dados.");
    }
  }

  function navigateTo(next: View) {
    window.location.hash = next;
    setView(next);
  }

  async function saveOrganization(input: NexoOrganizacaoInput) {
    if (preview) {
      const id = editTarget?.kind === "organization" ? editTarget.id : crypto.randomUUID();
      setOrganizations((current) => {
        const existing = current.find((item) => item.id === id);
        const updated: NexoOrganizacao = {
          id,
          nome: input.nome,
          sigla: input.sigla || null,
          status: input.status,
          cor: input.cor,
          descricao: input.descricao || null,
          area_atuacao: input.area_atuacao || null,
          nivel_risco: input.nivel_risco,
          simbolo_path: existing?.simbolo_path || null,
          created_at: existing?.created_at || new Date().toISOString(),
        };
        return existing
          ? current.map((item) => (item.id === id ? updated : item))
          : [...current, updated];
      });
    } else {
      const repo = await import("@/lib/repositories/nexoRepository");
      if (editTarget?.kind === "organization") {
        await repo.updateNexoOrganizacao(editTarget.id, input);
      } else {
        await repo.createNexoOrganizacao(input);
      }
      await reload();
    }
    setNotice(
      editTarget
        ? "Cadastro da facção atualizado"
        : preview
          ? "Organização criada apenas nesta demonstração"
          : "Organização cadastrada",
    );
  }

  async function savePerson(input: NexoPessoaInput, creationRequestId: string) {
    let photoPending = false;
    if (preview) {
      const existing =
        editTarget?.kind === "person"
          ? people.find((item) => item.id === editTarget.id)
          : undefined;
      const id = existing?.id || crypto.randomUUID();
      const org = organizations.find((item) => item.id === input.organizacao_id);
      const person = previewPersonFromInput(input, id, org, existing);
      const endedLinkId = existing?.vinculos.find(
        (link) =>
          link.status !== "desvinculado" &&
          person.vinculos.some(
            (updated) => updated.id === link.id && updated.status === "desvinculado",
          ),
      )?.id;
      setPeople((current) =>
        existing
          ? current.map((item) =>
              item.id === existing.id
                ? person
                : endedLinkId
                  ? {
                      ...item,
                      vinculos: item.vinculos.map((link) =>
                        link.superior_vinculo_id === endedLinkId
                          ? { ...link, superior_vinculo_id: null }
                          : link,
                      ),
                    }
                  : item,
            )
          : [person, ...current],
      );
    } else {
      const repo = await import("@/lib/repositories/nexoRepository");
      const existing =
        editTarget?.kind === "person"
          ? people.find((item) => item.id === editTarget.id)
          : undefined;
      if (existing) {
        photoPending = (await repo.updateNexoPessoa(existing, input)).photoPending;
      } else {
        photoPending = (await repo.createNexoPessoa(input, creationRequestId)).photoPending;
      }
      await reload();
    }
    setNotice(
      photoPending
        ? "Ficha salva. A fotografia ficou pendente; reabra o cadastro para reenviar."
        : editTarget
          ? "Cadastro da pessoa atualizado"
          : preview
            ? "Pessoa criada apenas nesta demonstração"
            : "Pessoa cadastrada",
    );
  }

  async function saveTerritory(input: NexoTerritorioInput) {
    if (preview) {
      const newTerritory: NexoTerritorio = {
        ...input,
        id: crypto.randomUUID(),
        fonte_resumo: input.fonte_resumo || null,
        observacoes: input.observacoes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setTerritories((current) => [...current, newTerritory]);
    } else {
      const repo = await import("@/lib/repositories/nexoRepository");
      const newTerritory = await repo.createNexoTerritorio(input);
      await reload();
    }
    navigateTo("painel");
    setNotice(preview ? "Área criada apenas nesta demonstração" : "Área territorial cadastrada");
  }

  async function deleteTerritory(id: string) {
    if (
      !window.confirm("Remover este local do dossiê? A remoção ficará registrada para auditoria.")
    )
      return;
    if (preview) {
      setTerritories((current) => current.filter((item) => item.id !== id));
    } else {
      const repo = await import("@/lib/repositories/nexoRepository");
      await repo.softDeleteNexoTerritorio(id);
      await reload();
    }
    setNotice("Local removido do dossiê");
  }

  async function uploadPhoto(person: NexoPessoa, file: File) {
    if (preview) {
      const photo = {
        id: crypto.randomUUID(),
        pessoa_id: person.id,
        storage_path: "preview",
        legenda: file.name,
        categoria: "album" as const,
        capturada_em: null,
        url: URL.createObjectURL(file),
      };
      setPeople((current) =>
        current.map((item) =>
          item.id === person.id ? { ...item, fotos: [...item.fotos, photo] } : item,
        ),
      );
    } else {
      const repo = await import("@/lib/repositories/nexoRepository");
      const photo = await repo.uploadNexoAlbumPhoto(person.id, file, file.name);
      setPeople((current) =>
        current.map((item) =>
          item.id === person.id ? { ...item, fotos: [...item.fotos, photo] } : item,
        ),
      );
    }
    setNotice("Foto adicionada à ficha");
  }

  async function deletePhoto(person: NexoPessoa, photoId: string) {
    if (preview) {
      setPeople((current) =>
        current.map((item) =>
          item.id === person.id ? { ...item, fotos: item.fotos.filter((photo) => photo.id !== photoId) } : item,
        ),
      );
    } else {
      const repo = await import("@/lib/repositories/nexoRepository");
      await repo.deleteNexoAlbumPhoto(photoId, person.id);
      await reload();
    }
    setNotice("Foto removida do álbum");
  }

  async function deletePerson(person: NexoPessoa) {
    if (preview) {
      setPeople((current) => current.filter((item) => item.id !== person.id));
    } else {
      const repo = await import("@/lib/repositories/nexoRepository");
      await repo.softDeleteNexoPessoa(person.id);
      await reload();
    }
    setDossier(null);
    setNotice("Cadastro apagado");
  }

  async function uploadOrganizationPhoto(organization: NexoOrganizacao, file: File, legenda: string) {
    const photo = preview
      ? {
          id: crypto.randomUUID(),
          organizacao_id: organization.id,
          pessoa_id: null,
          storage_path: "preview",
          legenda: legenda.trim() || file.name,
          categoria: "album" as const,
          capturada_em: null,
          url: URL.createObjectURL(file),
        }
      : await (async () => {
          const repo = await import("@/lib/repositories/nexoRepository");
          return repo.uploadNexoOrganizacaoPhoto(organization.id, file, legenda.trim() || file.name);
        })();
    setOrganizations((current) =>
      current.map((item) =>
        item.id === organization.id ? { ...item, fotos: [...(item.fotos ?? []), photo] } : item,
      ),
    );
    setNotice("Imagem adicionada à facção");
  }

  async function deleteOrganizationPhoto(organization: NexoOrganizacao, photoId: string) {
    if (preview) {
      setOrganizations((current) =>
        current.map((item) =>
          item.id === organization.id
            ? { ...item, fotos: (item.fotos ?? []).filter((photo) => photo.id !== photoId) }
            : item,
        ),
      );
    } else {
      const repo = await import("@/lib/repositories/nexoRepository");
      await repo.deleteNexoOrganizacaoPhoto(photoId, organization.id);
      await reload();
    }
    setNotice("Imagem removida da facção");
  }

  async function deleteOrganization(organization: NexoOrganizacao) {
    if (preview) {
      setOrganizations((current) => current.filter((item) => item.id !== organization.id));
    } else {
      const repo = await import("@/lib/repositories/nexoRepository");
      await repo.softDeleteNexoOrganizacao(organization.id);
      await reload();
    }
    setDossier(null);
    setNotice("Facção apagada");
  }

  async function saveLink(input: NexoLinkInput) {
    if (preview) {
      const organization = organizations.find((item) => item.id === input.organizacao_id);
      const linkedPerson = people.find((item) => item.id === input.pessoa_id);
      if (linkedPerson) {
        const superior = people.find((item) =>
          item.vinculos.some((link) => link.id === input.superior_vinculo_id),
        );
        setPreviewHierarchyEvents((events) => [
          {
            id: crypto.randomUUID(),
            organizacao_id: input.organizacao_id,
            pessoa_id: linkedPerson.id,
            vinculo_id: crypto.randomUUID(),
            tipo: input.status === "desvinculado" ? "saida" : "entrada",
            funcao_anterior: null,
            funcao_nova: input.funcao || null,
            superior_anterior_nome: null,
            superior_novo_nome: superior?.nome || null,
            status_anterior: null,
            status_novo: input.status,
            pessoa_nome: linkedPerson.nome,
            justificativa: input.fonte_resumo || null,
            ocorrido_em: new Date().toISOString(),
            autor: { nome: "Demonstração" },
          },
          ...events,
        ]);
      }
      setPeople((current) =>
        current.map((person) =>
          person.id === input.pessoa_id
            ? {
                ...person,
                vinculos: [
                  ...person.vinculos,
                  {
                    id: crypto.randomUUID(),
                    superior_vinculo_id:
                      input.status === "desvinculado" ? null : input.superior_vinculo_id,
                    pessoa_id: person.id,
                    organizacao_id: input.organizacao_id,
                    status: input.status,
                    funcao: input.funcao || null,
                    confianca: input.confianca,
                    fonte_resumo: input.fonte_resumo || null,
                    desde: null,
                    ate: null,
                    organizacao: organization || null,
                  },
                ],
              }
            : person,
        ),
      );
    } else {
      const repo = await import("@/lib/repositories/nexoRepository");
      await repo.createNexoVinculo(input);
      await reload();
    }
    setNotice(preview ? "Vínculo criado apenas nesta demonstração" : "Vínculo registrado");
  }

  async function manageLink(input: NexoVinculoManagementInput) {
    if (preview) {
      const destination = organizations.find((item) => item.id === input.organizacao_id) || null;
      const today = new Date().toISOString().slice(0, 10);
      const currentPerson = people.find((item) => item.id === input.pessoa_id);
      const currentLink = currentPerson?.vinculos.find((link) => link.id === input.vinculo_id);
      const allLinks = people.flatMap((item) =>
        item.vinculos.map((link) => ({ link, name: item.nome })),
      );
      if (currentPerson && currentLink) {
        const eventBase: NexoHierarquiaEvento = {
          id: crypto.randomUUID(),
          organizacao_id: currentLink.organizacao_id,
          pessoa_id: currentPerson.id,
          vinculo_id: currentLink.id,
          tipo: input.acao === "remover" || input.acao === "transferir" ? "saida" : "alteracao",
          funcao_anterior: currentLink.funcao,
          funcao_nova: input.acao === "remover" ? currentLink.funcao : input.funcao || null,
          superior_anterior_nome:
            allLinks.find((entry) => entry.link.id === currentLink.superior_vinculo_id)?.name ||
            null,
          superior_novo_nome:
            input.acao === "remover"
              ? null
              : allLinks.find((entry) => entry.link.id === input.superior_vinculo_id)?.name || null,
          status_anterior: currentLink.status,
          status_novo:
            input.acao === "remover" || input.acao === "transferir" ? "desvinculado" : input.status,
          pessoa_nome: currentPerson.nome,
          justificativa: input.fonte_resumo || null,
          ocorrido_em: new Date().toISOString(),
          autor: { nome: "Demonstração" },
        };
        setPreviewHierarchyEvents((events) => [
          ...(input.acao === "transferir"
            ? [
                {
                  ...eventBase,
                  id: crypto.randomUUID(),
                  organizacao_id: input.organizacao_id,
                  tipo: "entrada" as const,
                  status_anterior: null,
                  status_novo: input.status,
                },
              ]
            : []),
          eventBase,
          ...events,
        ]);
      }
      setPeople((current) =>
        current.map((person) => {
          if (person.id !== input.pessoa_id) {
            if (input.acao === "atualizar") return person;
            return {
              ...person,
              vinculos: person.vinculos.map((link) =>
                link.superior_vinculo_id === input.vinculo_id
                  ? { ...link, superior_vinculo_id: null }
                  : link,
              ),
            };
          }
          if (input.acao === "remover") {
            return {
              ...person,
              vinculos: person.vinculos.map((link) =>
                link.id === input.vinculo_id
                  ? { ...link, status: "desvinculado", superior_vinculo_id: null, ate: today }
                  : link,
              ),
            };
          }
          if (input.acao === "atualizar") {
            return {
              ...person,
              vinculos: person.vinculos.map((link) =>
                link.id === input.vinculo_id
                  ? {
                      ...link,
                      status: input.status,
                      funcao: input.funcao || null,
                      confianca: input.confianca,
                      fonte_resumo: input.fonte_resumo || null,
                      superior_vinculo_id: input.superior_vinculo_id,
                      ate: null,
                    }
                  : link,
              ),
            };
          }
          const existingDestination = person.vinculos.find(
            (link) => link.id !== input.vinculo_id && link.organizacao_id === input.organizacao_id,
          );
          const updated = person.vinculos.map((link) => {
            if (link.id === input.vinculo_id) {
              return {
                ...link,
                status: "desvinculado" as const,
                superior_vinculo_id: null,
                ate: today,
              };
            }
            if (link.id === existingDestination?.id) {
              return {
                ...link,
                status: input.status,
                funcao: input.funcao || null,
                confianca: input.confianca,
                fonte_resumo: input.fonte_resumo || null,
                superior_vinculo_id: input.superior_vinculo_id,
                desde: today,
                ate: null,
                organizacao: destination,
              };
            }
            return link;
          });
          if (!existingDestination) {
            updated.push({
              id: crypto.randomUUID(),
              superior_vinculo_id: input.superior_vinculo_id,
              pessoa_id: person.id,
              organizacao_id: input.organizacao_id,
              status: input.status,
              funcao: input.funcao || null,
              confianca: input.confianca,
              fonte_resumo: input.fonte_resumo || null,
              desde: today,
              ate: null,
              organizacao: destination,
            });
          }
          return { ...person, vinculos: updated };
        }),
      );
    } else {
      const repo = await import("@/lib/repositories/nexoRepository");
      await repo.manageNexoVinculo(input);
      await reload();
    }
    const message =
      input.acao === "remover"
        ? "Pessoa removida da facção; o vínculo foi preservado no histórico"
        : input.acao === "transferir"
          ? "Pessoa transferida e novo vínculo registrado"
          : "Cargo e vínculo atualizados";
    setNotice(preview ? `${message} nesta demonstração` : message);
  }

  return (
    <div className="nexo-workspace">
      {booting ? <NexoBootSequence /> : null}
      <header className="nexo-workspace-header">
        <div className="nexo-header-top">
          <div className="flex min-w-0 items-center">
            <button
              type="button"
              onClick={() => navigateTo("painel")}
              aria-label="NEXO · Voltar à Central"
              className="flex shrink-0 items-center gap-3 rounded-lg py-2 text-left"
            >
              <span className="nexo-brand-mark">
                <Radar className="h-[23px] w-[23px]" />
              </span>
              <span>
                <strong className="block text-[21px] font-extrabold leading-none tracking-[-.04em]">
                  NEXO
                </strong>
                <small className="mt-1.5 block text-[9px] font-semibold uppercase tracking-[.16em] text-[#94bfce]">
                  Inteligência integrada
                </small>
              </span>
            </button>
            <div className="nexo-header-context">
              <span>Área de trabalho</span>
              <span aria-hidden className="text-[#54768b]">
                /
              </span>
              <strong>{VIEWS.find((item) => item.id === view)?.label}</strong>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {preview ? (
              <span className="hidden items-center gap-2 rounded-md border border-[#b6c9d42b] px-2.5 py-1.5 text-[11px] text-[#b1cad7] sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-[#edc685]" />
                Demonstração
              </span>
            ) : null}
            <button
              type="button"
              aria-label="Buscar no NEXO (Ctrl K)"
              title="Buscar no NEXO (Ctrl K)"
              onClick={() => setSearchOpen(true)}
              className="nexo-header-search"
            >
              <Search className="h-4 w-4 text-[#8dc5d6]" />
              <span className="hidden sm:inline">Buscar no NEXO</span>
              <kbd>Ctrl K</kbd>
            </button>
            {!preview ? (
              <button
                type="button"
                disabled={loading}
                onClick={() => void reload()}
                aria-label="Atualizar dados"
                title="Atualizar dados"
                className="nexo-header-search disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            ) : null}
          </div>
        </div>
        <nav aria-label="Seções do NEXO" className="nexo-header-navigation">
          {VIEWS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateTo(item.id)}
                aria-current={view === item.id ? "page" : undefined}
                className="nexo-nav-item"
              >
                <Icon aria-hidden className="h-[15px] w-[15px]" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      <div className="nexo-content">
        {error ? (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <span>{error}</span>
            {!preview ? (
              <button
                type="button"
                disabled={loading}
                onClick={() => void reload()}
                className="ml-3 font-bold underline disabled:opacity-50"
              >
                Tentar novamente
              </button>
            ) : null}
          </div>
        ) : null}
        {loading ? (
          <div className="mt-6 flex min-h-[450px] items-center justify-center rounded-3xl border border-[#e3ebf1] bg-white">
            <div className="text-center">
              <div className="nexo-loader-ring mx-auto" />
              <p className="mt-4 text-xs font-bold uppercase tracking-wider text-[#7b93a3]">
                Carregando panorama
              </p>
            </div>
          </div>
        ) : null}

        {!loading && view === "painel" ? (
          <NexoCommandDashboard
            data={workspaceData}
            onCreatePerson={() => startCreate("pessoa")}
            onCreateOrganization={() => startCreate("organizacao")}
            onNavigate={navigateTo}
            onOpen={openDossier}
            onSearch={() => setSearchOpen(true)}
          />
        ) : null}

        {!loading && (view === "organizacoes" || view === "pessoas") ? (
          <NexoDirectoryPanel
            key={view}
            kind={view === "pessoas" ? "people" : "organizations"}
            organizations={organizations}
            people={people}
            territories={territories}
            records={reportRecords}
            onOpen={openDossier}
            onCreatePerson={() => startCreate("pessoa")}
            onCreateOrganization={() => startCreate("organizacao")}
          />
        ) : null}

        {!loading && view === "inteligencia" ? (
          <NexoIntelligenceBoard
            organizations={organizations}
            people={people}
            territories={territories}
            records={reportRecords}
            onOpen={openDossier}
          />
        ) : null}

        {!loading && view === "mapa" ? (
          <NexoRoutesPanel
            people={people}
            organizations={organizations}
            onOpenPerson={(id) => openDossier({ kind: "person", id })}
          />
        ) : null}

        {!loading && view === "procedimentos" ? (
          <NexoProceduresDashboard
            organizations={organizations}
            people={people}
            preview={preview}
            previewRows={presentationProcedureRows}
          />
        ) : null}

        {!loading && view === "relatorios" ? (
          <NexoReportsHub
            organizations={organizations}
            people={people}
            busy={preparingReport}
            onConfigure={(scope) => void prepareReport(scope)}
          />
        ) : null}

        <NexoCommandPalette
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          data={workspaceData}
          onChoose={chooseSearchResult}
          onCreatePerson={() => startCreate("pessoa")}
          onCreateOrganization={() => startCreate("organizacao")}
        />
        {configuringReport ? (
          <NexoReportConfigurator
            initialScope={configuringReport}
            organizacoes={organizations}
            pessoas={people}
            territorios={territories}
            registros={reportRecords}
            observacoes={reportNotes}
            busy={printing}
            onClose={() => setConfiguringReport(null)}
            onGenerate={(scope, config) => void generateReport(scope, config)}
          />
        ) : null}

        <NexoReport
          scope={reportScope}
          organizacoes={organizations}
          pessoas={people}
          territorios={territories}
          registros={reportRecords}
          observacoes={reportNotes}
          config={reportConfig}
        />
        {dossier ? (
          <NexoDossier
            key={`${dossier.kind}:${dossier.id}`}
            target={dossier}
            organizations={organizations}
            people={people}
            territories={territories}
            records={reportRecords}
            onProcedureRecordsChange={setReportRecords}
            previewHierarchyEvents={previewHierarchyEvents}
            previewNotes={reportNotes}
            onPreviewNoteCreated={(note) => setReportNotes((current) => [note, ...current])}
            preview={preview}
            onClose={() => void closeDossier()}
            onOpen={openDossier}
            onReport={() =>
              void prepareReport(
                dossier.kind === "person"
                  ? { kind: "pessoa", pessoaId: dossier.id }
                  : { kind: "organizacao", organizacaoId: dossier.id },
              )
            }
            onEdit={(target) => {
              setEditTarget(target);
              setCreateOrganizationId(null);
              setCreateKind(target.kind === "person" ? "pessoa" : "organizacao");
            }}
            onUploadPhoto={uploadPhoto}
            onDeletePhoto={deletePhoto}
            onDeletePerson={deletePerson}
            onUploadOrganizationPhoto={uploadOrganizationPhoto}
            onDeleteOrganizationPhoto={deleteOrganizationPhoto}
            onDeleteOrganization={deleteOrganization}
            onCreateLink={saveLink}
            onManageLink={manageLink}
            onCreatePersonForOrganization={(organizationId) => {
              setCreateOrganizationId(organizationId);
              setCreateKind("pessoa");
            }}
            onCreateTerritoryForOrganization={(organizationId) => {
              setCreateOrganizationId(organizationId);
              setCreateKind("territorio");
            }}
            onDeleteTerritory={deleteTerritory}
          />
        ) : null}
        {createKind ? (
          <NexoCreateDialog
            kind={createKind}
            initialOrganizationId={createOrganizationId}
            initialOrganization={
              editTarget?.kind === "organization"
                ? organizations.find((item) => item.id === editTarget.id) || null
                : null
            }
            initialPerson={
              editTarget?.kind === "person"
                ? people.find((item) => item.id === editTarget.id) || null
                : null
            }
            organizations={organizations}
            people={people}
            territories={territories}
            onClose={() => {
              setCreateKind(null);
              setCreateOrganizationId(null);
              setEditTarget(null);
            }}
            onSaveOrganization={saveOrganization}
            onSavePerson={savePerson}
            onSaveTerritory={saveTerritory}
            onResolvePersonConflict={async () => {
              await reload();
              setCreateKind(null);
              setCreateOrganizationId(null);
              setEditTarget(null);
              setNotice("Versão mais recente da ficha carregada");
            }}
          />
        ) : null}
        {notice ? (
          <div
            role="status"
            className="fixed bottom-5 right-5 z-[1400] max-w-[calc(100vw-40px)] rounded-xl border border-[#b5dfe6] bg-[#e8f8fa] px-4 py-3 text-xs font-bold text-[#1c6f84] shadow-lg"
          >
            <BadgeCheck className="mr-2 inline h-4 w-4" />
            {notice}
          </div>
        ) : null}
        {preview ? (
          <span className="fixed bottom-4 left-4 z-50 rounded-lg border border-[#b7dce3] bg-white/95 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#2b7185] shadow-lg">
            Dados fictícios · alterações locais
          </span>
        ) : null}
      </div>
    </div>
  );
}
