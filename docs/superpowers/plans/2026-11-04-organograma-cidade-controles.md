# Organograma: cidade de atuação e controles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persistir e exibir a cidade/UF de atuação de cada vínculo, garantir os três controles do cartão e reenquadrar o organograma rigidamente a cada 15 segundos.

**Architecture:** O local de atuação será um atributo opcional de `nexo_vinculos`, propagado pelos fluxos atômicos e auditado pelo gatilho existente. O componente do organograma apenas apresenta esse dado e usa um agendador isolado para chamar a mesma função de Ajustar à tela a cada 15 segundos, sem alterar o estado estrutural da árvore.

**Tech Stack:** React 19, TypeScript, Supabase/PostgreSQL, XYFlow, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-11-04-organograma-cidade-controles-design.md`

## Global Constraints

- Nenhuma migration será executada em produção sem aprovação explícita.
- Não inferir cidade pelo endereço, cargo, organização ou procedimentos.
- Manter RLS, `security invoker` e o controle de acesso existentes.
- Não adicionar dependências.
- O intervalo do organograma é rígido em 15.000 ms e não reinicia com interações.
- A recentralização altera somente viewport; busca, seleção e ramificações permanecem.

## Review Focus

- Vínculos antigos com cidade nula continuam carregando e renderizando sem separadores vazios.
- UF informada fora do formato de duas letras deve ser rejeitada no banco e limitada na interface.
- Transferência preserva a cidade fornecida no novo vínculo, sem copiar silenciosamente o local anterior.
- Mudança de cidade gera exatamente um evento de auditoria; salvar sem alteração não gera evento.
- Interagir continuamente com zoom/pan não adia o reenquadramento de 15 segundos.

---

### Task 1: Schema incremental e auditoria

**Files:**
- Create: `supabase/migrations/<timestamp>_nexo_vinculo_local_atuacao.sql`
- Create: `tests/migrations/nexo-vinculo-local-atuacao.test.mjs`

**Interfaces:**
- Produces: `nexo_vinculos.municipio_atuacao text`, `nexo_vinculos.uf_atuacao text`, campos anterior/novo em `nexo_hierarquia_eventos` e RPC `nexo_gerenciar_vinculo(..., p_municipio_atuacao text, p_uf_atuacao text)`.
- Preserves: RLS e grants existentes; nenhuma aplicação remota.

- [ ] Escrever teste lexical que exige colunas, constraint de UF, auditoria sem duplicata, `security invoker`, grants e propagação nos fluxos atômicos.
- [ ] Executar o teste e confirmar falha por migration ausente.
- [ ] Criar a migration com `pnpm exec supabase migration new nexo_vinculo_local_atuacao` e implementar alterações incrementais.
- [ ] Executar o teste lexical e o replay/schema check aplicável; confirmar sucesso sem conectar à produção.
- [ ] Commitar schema e teste.

### Task 2: Tipos, cadastro, persistência e apresentação

**Files:**
- Modify: `src/features/nexo/nexoTypes.ts`
- Modify: `src/lib/repositories/nexoRepository.ts`
- Modify: `src/features/nexo/components/NexoCreateDialog.tsx`
- Modify: `src/features/nexo/components/NexoPersonWizard.tsx`
- Modify: `src/features/nexo/components/NexoLinkForm.tsx`
- Modify: `src/features/nexo/components/NexoDossier.tsx`
- Modify: `src/features/nexo/components/NexoOrganogram.tsx`
- Modify: `src/features/nexo/pages/NexoWorkspacePage.tsx`
- Modify: dados sintéticos e fixtures tipadas que constroem `NexoVinculo`
- Test: `src/features/nexo/nexoLinkLocation.test.ts`
- Test: `tests/e2e/nexo-organogram.e2e.ts`

**Interfaces:**
- Produces: `municipio_atuacao: string | null` e `uf_atuacao: string | null` em `NexoVinculo`; campos equivalentes nos inputs de criação/gestão; `formatNexoLinkRoleLocation(link)` para apresentação segura.
- Consumes: schema e RPC da Task 1.

- [ ] Escrever testes unitários para formatação completa, parcial e nula, além de teste E2E que abre gerenciamento e salva cidade sintética no preview.
- [ ] Executar os testes e confirmar falha pela ausência dos campos/controle.
- [ ] Propagar os campos pelos tipos, selects, payloads, preview e três formulários; normalizar UF em maiúsculas.
- [ ] Exibir `Cargo · Cidade/UF` no cartão, busca e painel lateral sem usar endereço residencial.
- [ ] Executar testes unitários, E2E, TypeScript e ESLint; confirmar sucesso.
- [ ] Commitar a entrega de cidade de atuação.

### Task 3: Controles do cartão e reenquadramento rígido

**Files:**
- Create: `src/features/nexo/organogramRecentering.ts`
- Create: `src/features/nexo/organogramRecentering.test.ts`
- Modify: `src/features/nexo/components/NexoOrganogram.tsx`
- Modify: `tests/e2e/nexo-organogram.e2e.ts`

**Interfaces:**
- Produces: `ORGANOGRAM_RECENTER_INTERVAL_MS = 15_000` e `scheduleRigidOrganogramRecentering(recenter)` com disposer.
- Preserves: função única `resetView` para botão manual e intervalo.

- [ ] Escrever teste unitário 14.999/15.000 ms e limpeza, e E2E para expandir/recolher, gerenciar, abrir dossiê e reenquadrar após zoom.
- [ ] Executar testes e confirmar as falhas esperadas antes da implementação.
- [ ] Implementar agendador, efeito com cleanup e classes `nodrag nopan` nos controles interativos.
- [ ] Expor estado de viewport observado somente para acessibilidade/teste e comprovar que seleção/ramificação não são alteradas.
- [ ] Executar E2E focado, Vitest completo, TypeScript, ESLint e build.
- [ ] Commitar, solicitar revisão independente, corrigir achados válidos e atualizar o Pull Request sem mesclar.
