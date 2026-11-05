# NEXO Map Recenter Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduzir o trabalho periódico do mapa da Central mantendo a recentralização automática a cada 10 segundos.

**Architecture:** Decisões puras em `mapRecentering.ts` identificarão a posição padrão e separarão o recenter automático instantâneo do recenter manual animado. O componente ignorará ciclos redundantes e deixará de manter estado para contar ciclos automáticos.

**Tech Stack:** React 19, TypeScript, Leaflet, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-05-nexo-map-recenter-performance-design.md`

## Global Constraints

- Manter o intervalo automático em `10_000` ms na Central.
- Não adicionar dependências ou alterar banco, autenticação ou dados.
- Respeitar `prefers-reduced-motion` no recenter manual.

## Review Focus

- Recenter automático nunca deve iniciar animação.
- Recenter manual deve continuar animado quando movimento reduzido não estiver ativo.
- Recenter manual deve ser instantâneo com movimento reduzido.
- O temporizador deve continuar sendo limpo no unmount.
- O mapa em modo de desenho não deve agendar recentralização.

---

### Task 1: Decisão de animação e componente

**Files:**
- Modify: `src/features/nexo/mapRecentering.ts`
- Modify: `src/features/nexo/mapRecentering.test.ts`
- Modify: `src/features/nexo/components/NexoTerritoryMap.tsx`

**Interfaces:**
- Produces: `shouldAnimateMapRecentering(automatic: boolean, prefersReducedMotion: boolean): boolean`

- [x] **Step 1: Write the failing test**

Adicionar casos para recenter automático, manual e preferência por movimento reduzido.

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm test src/features/nexo/mapRecentering.test.ts`
Expected: FAIL porque `shouldAnimateMapRecentering` ainda não existe.

- [x] **Step 3: Implement the minimal production change**

Implementar a decisão pura, usá-la no componente e remover `automaticRecenterCount`.

- [x] **Step 4: Run targeted and full verification**

Run: `pnpm test src/features/nexo/mapRecentering.test.ts`, `pnpm lint`, `pnpm test`, `pnpm run build:worker`.

- [x] **Step 5: Measure the preview**

Confirmar montagem do mapa e ausência do contador visual após 10 segundos.
