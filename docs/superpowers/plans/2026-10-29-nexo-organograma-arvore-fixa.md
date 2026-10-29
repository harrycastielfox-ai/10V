# NEXO Organograma como árvore fixa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o organograma em uma árvore fixa e responsiva, sem controles ou gestos de mapa.

**Architecture:** `@xyflow/react` permanece responsável pelo posicionamento e pelas arestas, mas sua viewport fica estática. A busca atualiza seleção, destaque e painel sem comandar a viewport.

**Tech Stack:** React, TypeScript, `@xyflow/react`, Vitest e Playwright.

**Spec:** `docs/superpowers/specs/2026-10-29-nexo-organograma-arvore-fixa-design.md`

## Global Constraints

- Preservar busca, expansão/recolhimento, cartões, linhas, painel lateral e abertura de perfis.
- Não alterar dados, banco, permissões ou demais abas.
- Não adicionar dependências.
- Implementar com teste falhando antes do código de produção.

## Review Focus

- Rolagem sobre a árvore deve continuar rolando a página, sem capturar o gesto.
- Clique e busca devem selecionar a pessoa correta sem mover a viewport.
- Ramificações recolhidas devem continuar reabrindo quando a busca seleciona um descendente.
- Os cartões devem permanecer legíveis no viewport de notebook.
- Nenhum controle de zoom, ajuste ou tela cheia pode reaparecer.

---

### Task 1: Fixar a apresentação da árvore

**Files:**
- Modify: `src/features/nexo/components/NexoOrganogram.tsx`
- Modify: `src/features/nexo/nexoVisual.css`
- Test: `tests/e2e/smoke.e2e.ts`

**Interfaces:**
- Consumes: modelo e nós existentes de `buildNexoOrganogram`.
- Produces: árvore React Flow enquadrada inicialmente e sem interações de viewport.

- [ ] **Step 1: Escrever o teste E2E falhando**

  Atualizar o cenário de notebook para exigir ausência de `Ajustar à tela`, `Tela cheia` e `.react-flow__controls`, e verificar que a transformação da viewport não muda após roda do mouse e busca.

- [ ] **Step 2: Executar o teste focado e confirmar RED**

  Run: `pnpm test:e2e --grep "renders the synthetic NEXO organogram as a fixed tree" --project=chromium`

- [ ] **Step 3: Remover controles e bloquear navegação da viewport**

  Remover estado/ref/efeito de fullscreen e centralização. Configurar `panOnDrag={false}`, `panOnScroll={false}`, `zoomOnScroll={false}`, `zoomOnPinch={false}`, `zoomOnDoubleClick={false}` e `preventScrolling={false}`. Manter `fitView` inicial.

- [ ] **Step 4: Remover estilos sem consumidores**

  Excluir regras exclusivas de fullscreen, botões de ferramenta e controles React Flow.

- [ ] **Step 5: Executar o teste focado e confirmar GREEN**

  Run: `pnpm test:e2e --grep "renders the synthetic NEXO organogram as a fixed tree" --project=chromium`

- [ ] **Step 6: Executar verificação completa**

  Run: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm build` e `pnpm test:e2e`.

- [ ] **Step 7: Commit**

  Run: `git add docs/superpowers src/features/nexo tests/e2e && git commit -m "fix(nexo): apresentar organograma como arvore fixa"`
