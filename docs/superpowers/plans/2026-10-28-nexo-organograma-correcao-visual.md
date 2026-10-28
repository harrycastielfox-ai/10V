# NEXO Organograma — Correção Visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar a apresentação atual em uma árvore vertical legível e demonstrá-la com dados de teste estruturados e fictícios.

**Architecture:** A projeção pura continuará responsável pelas coordenadas, agora com profundidade no eixo Y e folhas no eixo X. O React Flow deixará de renderizar o agrupador virtual e o preview passará a selecionar oito registros sintéticos por organização do fixture existente.

**Tech Stack:** React 19, TypeScript, `@xyflow/react`, Vitest e Playwright.

**Spec:** `docs/superpowers/specs/2026-10-28-nexo-organograma-correcao-visual-design.md`

## Global Constraints

- Trabalhar no PR existente e mesclar somente após validação completa.
- Não usar dados investigativos reais; o preview deve permanecer explicitamente fictício.
- Não criar migrations nem publicar no Cloudflare.
- Preservar busca, zoom, pan, colapso, tela cheia, dossiê e gestão existentes.
- Não renderizar minimapa; a árvore deve ocupar o canvas sem sobreposições.

## Review Focus

- Uma raiz sem superior não pode receber aresta de entrada nem parecer liderança inferida.
- Irmãos precisam ocupar posições X distintas e descendentes precisam avançar no eixo Y.
- O cenário de demonstração deve ter oito pessoas por organização sem apontar para superiores ausentes no recorte.
- Retratos referenciados precisam existir no diretório público.
- O canvas não pode introduzir overflow horizontal no viewport de notebook.

---

### Task 1: Layout vertical sem nó artificial

**Files:**

- Modify: `src/features/nexo/nexoOrganogram.test.ts`
- Modify: `src/features/nexo/nexoOrganogram.ts`
- Modify: `src/features/nexo/components/NexoOrganogram.tsx`
- Modify: `src/features/nexo/nexoVisual.css`

**Interfaces:**

- Consumes: `buildNexoOrganogram`, `NexoOrganogramMember.position` e nós React Flow existentes.
- Produces: coordenadas verticais e raízes sem aresta artificial.

- [ ] **Step 1:** Alterar primeiro o teste da projeção para exigir maior `position.y` em descendentes e posições X diferentes para irmãos.
- [ ] **Step 2:** Executar o teste e confirmar RED com as coordenadas horizontais atuais.
- [ ] **Step 3:** Trocar o layout para folhas no eixo X e profundidade no eixo Y.
- [ ] **Step 4:** Remover o nó virtual e arestas artificiais do canvas, ajustar handles e ampliar os cartões.
- [ ] **Step 5:** Executar testes focados, lint e TypeScript até GREEN.
- [ ] **Step 6:** Commitar como `fix(nexo): reorganizar organograma em árvore vertical`.

### Task 2: Cenário fictício com ramificações reais

**Files:**

- Modify: `src/features/nexo/nexoApprovalDemoData.test.ts`
- Modify: `src/features/nexo/nexoApprovalDemoData.ts`
- Modify: `tests/e2e/smoke.e2e.ts`

**Interfaces:**

- Consumes: `NEXO_PRESENTATION_DATA.people` e retratos sintéticos versionados.
- Produces: oito pessoas fictícias por organização no preview local.

- [ ] **Step 1:** Alterar primeiro o teste do fixture para exigir oito pessoas, três níveis e bifurcação por organização.
- [ ] **Step 2:** Executar o teste e confirmar RED com as três pessoas atuais.
- [ ] **Step 3:** Selecionar oito pessoas por organização e mapear somente retratos sintéticos existentes.
- [ ] **Step 4:** Atualizar o smoke test para validar oito integrantes e ausência do nó artificial.
- [ ] **Step 5:** Executar testes focados e Playwright até GREEN.
- [ ] **Step 6:** Commitar como `testdata(nexo): ampliar cenário fictício do organograma`.

### Task 3: Verificação e merge

**Files:**

- Modify: `docs/nexo-organograma-fase-1-2.md`

**Interfaces:**

- Consumes: Tasks 1–2.
- Produces: PR atualizado, evidência visual e merge do PR na `main`.

- [ ] **Step 1:** Capturar e inspecionar nova screenshot no localhost.
- [ ] **Step 2:** Executar lint, Vitest, TypeScript, build, bundle, schema e Playwright completos.
- [ ] **Step 3:** Atualizar relatório e screenshot, commitar e enviar ao PR.
- [ ] **Step 4:** Aguardar CI verde e mesclar o PR sem force-push.
- [ ] **Step 5:** Atualizar o checkout local da `main` e confirmar o commit remoto.
