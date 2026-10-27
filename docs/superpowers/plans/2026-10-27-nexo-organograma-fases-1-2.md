# NEXO Organograma 2.0 — Fases 1 e 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar uma aba Organograma interativa no dossiê de facção, usando os vínculos NEXO atuais sem escrita no banco.

**Architecture:** Uma projeção pura converte vínculos em floresta e coordenadas determinísticas; um componente React Flow renderiza e navega essa projeção; o dossiê conecta os callbacks existentes de perfil e gestão. Nenhuma função/cargo é interpretada como nível hierárquico.

**Tech Stack:** React 19, TypeScript, Vitest, Tailwind CSS, `@xyflow/react`, Supabase/PostgreSQL existente (somente leitura nesta entrega).

**Spec:** `docs/superpowers/specs/2026-10-27-nexo-organograma-fases-1-2-design.md`

## Global Constraints

- Trabalhar apenas na branch `feature/nexo-organograma-2-fase-1-2`; nunca modificar `main`.
- Usar somente dados sintéticos em testes, screenshots e documentação.
- Não executar migrations nem alterar ambiente Supabase remoto.
- Preservar as abas e fluxos existentes do dossiê e do dashboard.
- Não persistir movimentação visual do canvas.
- Respeitar RLS, fotos privadas, acessibilidade e `prefers-reduced-motion`.

## Review Focus

- Superior inexistente ou de outra organização deve manter a pessoa visível em posição não determinada.
- Ciclo legado não deve travar a construção nem ocultar integrantes.
- Dois vínculos atuais da mesma pessoa não podem colidir por `pessoa_id`.
- Busca sem acentos e por alcunha deve selecionar o vínculo correto e revelar ancestrais.
- Recolher uma ramificação não pode remover outros ramos nem o nó selecionado do modelo-base.

---

### Task 1: Projeção hierárquica pura

**Files:**
- Create: `src/features/nexo/nexoOrganogram.ts`
- Create: `src/features/nexo/nexoOrganogram.test.ts`

**Interfaces:**
- Consumes: `NexoPessoa`, `NexoVinculo`.
- Produces: `buildNexoOrganogram`, `searchNexoOrganogram`, `getNexoOrganogramAncestors`, `getVisibleNexoOrganogram` e tipos do modelo.

- [ ] **Step 1: Write the failing tests** para todos os membros elegíveis, múltiplas ramificações, raízes não determinadas, superior inválido, ciclo, vínculos duplicados, busca normalizada e colapso.
- [ ] **Step 2: Run tests to verify RED** com `pnpm test -- src/features/nexo/nexoOrganogram.test.ts` e confirmar falha por módulo ausente.
- [ ] **Step 3: Implement the pure model** com identidades por `vinculo.id`, nó virtual `undetermined`, detecção de ciclos e layout horizontal determinístico.
- [ ] **Step 4: Run tests to verify GREEN** com o mesmo comando.
- [ ] **Step 5: Commit** como `feat(nexo): modelar projeção do organograma`.

### Task 2: Canvas interativo e painel contextual

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `src/features/nexo/components/NexoOrganogram.tsx`
- Modify: `src/features/nexo/nexoVisual.css`

**Interfaces:**
- Consumes: funções do Task 1, `getNexoPersonPhotoUrl`, `onOpen(person)`, `onManage(person, link)`.
- Produces: `NexoOrganogram` com props `organization`, `members`, `onOpen`, `onManage`, `loading?`, `error?`.

- [ ] **Step 1: Add a failing presentation test** que exige rótulos e estados acessíveis exportados pelo componente.
- [ ] **Step 2: Run the focused test to verify RED**.
- [ ] **Step 3: Install pinned `@xyflow/react`** e implementar canvas, controles, minimapa, busca/foco, colapso, fullscreen, nós compactos e painel lateral.
- [ ] **Step 4: Add scoped visual rules** para notebook, tablet, fullscreen e reduced motion.
- [ ] **Step 5: Run focused tests and TypeScript** até GREEN.
- [ ] **Step 6: Commit** como `feat(nexo): adicionar canvas interativo do organograma`.

### Task 3: Integração no dossiê

**Files:**
- Modify: `src/features/nexo/components/NexoDossier.tsx`
- Modify: `src/features/nexo/components/NexoDossier.test.ts`

**Interfaces:**
- Consumes: `NexoOrganogram` do Task 2 e diálogo existente `LinkManagementDialog`.
- Produces: aba `organograma` exclusiva de organização, com abertura de perfil e gestão de vínculo existentes.

- [ ] **Step 1: Extend the dossier test first** para exigir a aba Organograma em organização, ausência em pessoa e preservação das abas atuais.
- [ ] **Step 2: Run the focused test to verify RED**.
- [ ] **Step 3: Register tab/icon and render the component** com membros atuais e callbacks existentes.
- [ ] **Step 4: Run dossier and organogram tests to verify GREEN**.
- [ ] **Step 5: Commit** como `feat(nexo): integrar organograma ao dossiê de facção`.

### Task 4: Validação, documentação e PR

**Files:**
- Create: `docs/nexo-organograma-fase-1-2.md`
- Modify: `docs/roadmap-nexo.md`

**Interfaces:**
- Consumes: entrega dos Tasks 1–3.
- Produces: relatório técnico, instruções localhost e evidências de validação.

- [ ] **Step 1: Run formatting check, lint, full Vitest, TypeScript and build** e registrar resultados reais.
- [ ] **Step 2: Run migration/schema checks** que não exigem escrita remota; registrar limites do ambiente.
- [ ] **Step 3: Start localhost and run Playwright/browser verification** quando suportado, somente com demo sintética.
- [ ] **Step 4: Update roadmap and phase report** com arquivos, reuso, banco, testes, riscos, validação e próxima fase.
- [ ] **Step 5: Commit** como `docs(nexo): documentar entrega inicial do organograma`.
- [ ] **Step 6: Push branch and open PR without merging**, incluindo resumo técnico, testes e limitações.
