# NEXO Organograma — núcleos e setores Implementation Plan

**Goal:** Persistir e gerenciar núcleos/setores internos no organograma, associando-os aos vínculos atuais com segurança, auditoria e representação visual explícita.

**Architecture:** `nexo_nucleos` representa agrupamentos internos por organização; `nexo_vinculos.nucleo_id` representa a participação atual. Validação e auditoria ficam no PostgreSQL, enquanto React reutiliza o gerenciamento de vínculo e o organograma existentes.

**Tech Stack:** React, TypeScript, Vitest, Playwright, Supabase/PostgreSQL e migrations versionadas.

## Restrições globais

- Trabalhar somente na branch `feat/nexo-organograma-nucleos-setores`.
- Não executar migration em produção.
- Usar apenas dados sintéticos em testes e screenshots.
- Não inferir núcleo por cargo, cidade ou posição hierárquica.
- Preservar pessoas sem núcleo e todas as abas/fluxos atuais.
- Seguir RED → GREEN → REFACTOR em cada comportamento.

### Task 1: Contrato de banco e auditoria

**Files:**
- Create: `supabase/migrations/20261104*_nexo_organogram_nuclei.sql`
- Modify: `tests/integration/database-migrations.test.ts`
- Modify: `tests/migrations/sql-lexical.test.mjs` somente se necessário para contrato específico

- [ ] Escrever teste de integração vermelho para criação, isolamento por organização, núcleo inválido, arquivamento, RLS e evento sem duplicata.
- [ ] Executar o teste e confirmar que falha pela ausência do schema.
- [ ] Criar migration incremental com tabela, índices, RLS, validação, RPCs e histórico.
- [ ] Reexecutar integração, migrations e schema replay até GREEN.
- [ ] Commitar o contrato de banco isoladamente.

### Task 2: Tipos, repositório e projeção

**Files:**
- Modify: `src/features/nexo/nexoTypes.ts`
- Modify: `src/lib/repositories/nexoRepository.ts`
- Modify: `src/lib/repositories/nexoRepository.test.ts`
- Modify: `src/features/nexo/nexoOrganogram.ts`
- Modify: `src/features/nexo/nexoOrganogram.test.ts`

- [ ] Escrever testes vermelhos para carregar núcleos, persistir `nucleo_id`, preservar integrantes sem núcleo e filtrar sem esconder a árvore completa por padrão.
- [ ] Implementar tipos, queries e projeção mínima.
- [ ] Executar testes focados e TypeScript até GREEN.
- [ ] Commitar a camada de dados.

### Task 3: Gestão e associação explícita

**Files:**
- Modify: `src/features/nexo/pages/NexoWorkspacePage.tsx`
- Modify: `src/features/nexo/components/NexoDossier.tsx`
- Modify: `src/features/nexo/components/NexoOrganogram.tsx`
- Modify: testes dos componentes afetados

- [ ] Escrever testes vermelhos para criar/renomear/arquivar núcleo, selecionar núcleo no vínculo e manter o formulário após falha.
- [ ] Implementar diálogo de núcleos e campo no gerenciamento do vínculo.
- [ ] Atualizar estado somente após persistência confirmada.
- [ ] Executar testes focados até GREEN.
- [ ] Commitar gestão e associação.

### Task 4: Visualização e validação final

**Files:**
- Modify: `src/features/nexo/components/NexoOrganogram.tsx`
- Modify: `src/features/nexo/nexoVisual.css`
- Modify: `tests/e2e/smoke.e2e.ts`
- Modify: `docs/roadmap-nexo.md`

- [ ] Escrever teste de interface para rótulo, filtro e integrantes sem núcleo.
- [ ] Exibir núcleo nos cartões/painel e adicionar filtro acessível.
- [ ] Validar notebook, tela cheia e teclado com dados sintéticos.
- [ ] Executar lint, Vitest completo, TypeScript, build, migrations, schema e Playwright aplicável.
- [ ] Atualizar roadmap e relatório com resultados reais e pendências.
- [ ] Solicitar revisão antes de integrar; não publicar Cloudflare nem aplicar migration remota.
