# Recentralização Automática do Mapa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recentralizar rigidamente o mapa territorial de Itabela a cada 30 segundos na visualização normal, preservando o modo de desenho.

**Architecture:** O componente `StreetMap` mantém uma função única de recentralização e cria um `setInterval` somente quando `drawing` é falso. O mesmo método atende o botão manual e o intervalo; a desmontagem remove o temporizador.

**Tech Stack:** React, TypeScript, Leaflet, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-11-04-mapa-recentralizacao-design.md`

## Global Constraints

- Intervalo rígido de 30.000 ms, sem reinício por zoom, arraste ou clique.
- Centro `[-16.575, -39.559]` e zoom `15`.
- Recentralização automática somente quando `drawing` é falso.
- Remover o intervalo ao desmontar o componente.
- Não adicionar dependências, migration ou gravação de dados.

## Review Focus

- Interações contínuas não podem adiar a recentralização.
- O formulário de desenho não pode se mover automaticamente.
- O temporizador não pode sobreviver à desmontagem.
- O botão manual deve continuar usando o mesmo centro e zoom.
- A transição automática deve respeitar `prefers-reduced-motion`.

---

### Task 1: Temporizador de recentralização

**Files:**
- Modify: `src/features/nexo/components/NexoTerritoryMap.tsx`
- Test: `tests/e2e/nexo-territory-map.e2e.ts`

**Interfaces:**
- Consumes: `LeafletMap.flyTo([number, number], number, options)` e a prop existente `onMapClick` que define `drawing`.
- Produces: recentralização automática visível, sem alterar props nem dados persistidos.

- [ ] **Step 1: Escrever teste de navegador com relógio controlado**

Criar o teste `recentraliza o mapa após 30 segundos mesmo com interação` e verificar: posição manual diferente; nenhuma recentralização em 29.999 ms; retorno ao centro após mais 1 ms; zoom e arraste não reiniciam o relógio.

- [ ] **Step 2: Executar o teste e confirmar falha**

Run: `pnpm test:e2e --grep "recentraliza o mapa" --project=chromium`

Expected: FAIL porque não existe intervalo automático.

- [ ] **Step 3: Implementar a função única de centralização e o intervalo**

Em `StreetMap`, criar constantes para centro, zoom e intervalo; reutilizar a função no botão; usar `setInterval` em um `useEffect` condicionado por `drawing`; escolher `flyTo` com animação desabilitada quando `prefers-reduced-motion` estiver ativo.

- [ ] **Step 4: Acrescentar cobertura para desenho e desmontagem**

No mesmo arquivo de teste, confirmar que o mapa do formulário não recentraliza depois de 30 segundos e que fechar o formulário não produz erro nem chamada posterior.

- [ ] **Step 5: Executar validações**

Run: `pnpm exec tsc --noEmit`

Run: `pnpm exec eslint src/features/nexo/components/NexoTerritoryMap.tsx tests/e2e/nexo-territory-map.e2e.ts`

Run: `pnpm test:e2e --grep "recentraliza o mapa" --project=chromium`

Expected: todas passam.

- [ ] **Step 6: Commit e push**

```bash
git add src/features/nexo/components/NexoTerritoryMap.tsx tests/e2e/nexo-territory-map.e2e.ts
git commit -m "feat(nexo): recentralizar mapa territorial a cada 30 segundos"
git push
```
