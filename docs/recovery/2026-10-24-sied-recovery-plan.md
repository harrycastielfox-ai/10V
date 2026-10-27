# Plano de recuperação do SIED/10V — 2026-10-24

## Objetivo e limites

Estabilizar o código local, eliminar vulnerabilidades corrigíveis, revisar contratos com o Supabase e ampliar a validação automatizada sem alterar produção, executar migrations remotas, usar dados reais em testes, fazer deploy, push ou merge.

O repositório público é uma decisão deliberada. Segredos, dados operacionais e dados pessoais continuam fora do código, logs e artefatos.

## Estratégia

1. Preservar alterações locais, sincronizar `main` apenas por fast-forward e trabalhar em branch `codex/`.
2. Registrar baseline reproduzível de dependências, lint, TypeScript, testes e build.
3. Corrigir dependências por advisory e cadeia efetiva do lockfile; revalidar após cada lote coerente.
4. Auditar autenticação, autorização, entradas, erros, rotas públicas e segredos com testes de regressão para toda correção.
5. Comparar migrations e metadados remotos do Supabase de forma somente leitura; preparar SQL idempotente, nunca aplicá-lo em produção automaticamente.
6. Reproduzir e corrigir contratos funcionais, priorizando HTTP 400/401, persistência e fluxos críticos.
7. Criar E2E isolado com dados sintéticos; marcar explicitamente testes bloqueados por falta de ambiente seguro.
8. Corrigir gargalos comprovados de forma incremental, melhorar CI e executar a matriz final completa.

## Critérios de validação

- `pnpm install --frozen-lockfile`
- `pnpm audit --json`
- `pnpm run lint`
- `pnpm exec tsc --noEmit`
- `pnpm run test`
- `pnpm run build`
- E2E Chromium em ambiente isolado quando configurado
- inspeções Supabase somente leitura e comparação determinística de migrations

## Checkpoints

- `stash@{0}` preserva os hooks e documentos locais anteriores à sincronização.
- A branch de trabalho parte do remoto sincronizado em `434f2ffdb868b7f3760f6c83be2caad2d9e66a73`.
- Não serão criados commits nem enviados dados sem autorização.
