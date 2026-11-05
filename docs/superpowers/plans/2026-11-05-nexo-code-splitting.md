# NEXO Code Splitting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduzir o chunk inicial do NEXO para no máximo 450 KB, carregando telas secundárias sob demanda.

**Architecture:** `NexoWorkspacePage` manterá a Central como dependência imediata e converterá painéis e modais condicionais para `React.lazy`. Limites locais de `Suspense` preservarão a página durante o carregamento de cada módulo.

**Tech Stack:** React 19, TypeScript, Vite, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-05-nexo-code-splitting-design.md`

## Global Constraints

- Chunk inicial `NexoWorkspacePage-*.js` com no máximo 450.000 bytes.
- Nenhuma dependência nova.
- Central permanece imediata; módulos secundários preservam comportamento.

## Review Focus

- Navegação para cada painel secundário deve resolver o chunk e renderizar a tela.
- A paleta fechada não deve iniciar seu chunk.
- Dossiê, criação e relatórios devem manter seus portais e ações.
- Falhas ou demora de rede devem mostrar fallback, não tela branca.
- Preview local e rota autenticada devem compartilhar o mesmo carregamento.

---

### Task 1: Orçamento do chunk inicial

**Files:**

- Modify: `scripts/check-bundle-budget.mjs`

- [x] Reduzir o limite para 450.000 bytes.
- [x] Executar `pnpm test:bundle` e confirmar falha contra o bundle atual.

### Task 2: Componentes secundários sob demanda

**Files:**

- Modify: `src/features/nexo/pages/NexoWorkspacePage.tsx`

- [x] Converter painéis e modais condicionais para imports lazy nomeados.
- [x] Adicionar limites de `Suspense` com fallback institucional.
- [x] Montar a paleta apenas quando aberta.
- [x] Executar lint, testes, build e orçamento de bundle.
- [x] Validar Central e navegação no preview local.
