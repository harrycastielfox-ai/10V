# Paridade do catálogo Supabase recuperado

Atualizado em: 2026-10-26

## Escopo e segurança

Esta comparação usa somente metadados de catálogo, sem copiar linhas operacionais. O catálogo remoto
foi consultado em modo somente leitura e comparado com o candidato local reconstruído. Nenhuma
migration, policy, permissão, função, bucket ou dado foi alterado em produção.

O relatório versionado em `tests/schema-replay/results/parity.json` contém apenas nomes, contagens,
classes de diferença e hashes; não contém corpos SQL, tokens, credenciais nem dados pessoais. O
comparador reproduzível está em `scripts/schema-replay/parity.mjs` e seus testes em
`tests/schema-replay/parity.test.mjs`.

## Catálogo remoto observado

| Objeto | Quantidade |
| --- | ---: |
| Relações públicas | 39 |
| Colunas públicas | 691 |
| Funções públicas | 79 |
| Policies de `public` e `storage` | 122 |
| Constraints públicas | 299 |
| Índices públicos | 186 |
| Enums públicos | 2 |
| Triggers da aplicação | 51 |
| Tabelas públicas com RLS desativado | 0 |
| Funções públicas `SECURITY DEFINER` executáveis por `anon` | 0 |

## Resultado estrutural

- Tabelas: 39/39 e enums: 2/2, sem ausência nominal no candidato.
- Colunas: o remoto possui cinco colunas que não existiam no histórico local recuperado:
  `auditoria.dados_anteriores`, `auditoria.dados_novos`, `auditoria.usuario`,
  `inqueritos.autoria_determinada` e `profiles.avatar_url`.
- Policies: quatro policies de proprietário de avatar em `storage.objects` existiam apenas no remoto.
- Índices: seis índices operacionais de `inqueritos` e `representacoes` existiam apenas no remoto.
- Triggers: três triggers existiam apenas no remoto, incluindo criação automática de perfil após
  usuário Auth e rastreamento de produtividade.
- Funções: seis funções da aplicação existiam apenas no remoto. As 37 funções marcadas como
  exclusivas do candidato eram ruído de posicionamento da extensão `pgcrypto` no PGlite, e não
  funções adicionais da aplicação.
- Constraints `NOT NULL` extras do candidato foram classificadas como diferença de modelagem do
  PGlite. Grants de `service_role` também não são tratados como equivalência produtiva porque o
  adaptador local não reproduz toda a plataforma Supabase.

As dependências privadas necessárias para os objetos remotos também foram identificadas:
`private.productivity_events`, `private.is_yes_like(text)`,
`private.track_inquerito_productivity()` e o event trigger `ensure_rls`. O bucket
`profile-avatars` remoto é público e não possui limites de MIME ou tamanho no catálogo observado;
essa constatação não é recomendação para alterar produção sem revisão específica.

## Proposta local de reconciliação

A migration `supabase/migrations/20261025181500_reconcile_live_catalog.sql` acrescenta, de forma
idempotente, os objetos remotos ausentes no candidato recuperado. Funções privilegiadas usam
`search_path` fixo e grants explícitos. A proposta foi executada somente em ambientes locais:

- replay completo: 122/122 migrations;
- probes de runtime: 10/10;
- testes específicos da migration: 2/2;
- stack Supabase local real: migração aplicada antes dos testes de Auth.

Ela **não foi aplicada em produção**. Antes de qualquer aplicação remota ainda é necessário revisar
o plano SQL final, criar backup/rollback operacional, validar em homologação e obter autorização
explícita.

## Limitações

- Paridade estrutural não prova equivalência de dados, volume, planos de execução ou comportamento
  sob carga.
- O relatório não reconcilia automaticamente o histórico remoto de migrations; essa decisão
  continua separada e documentada em `2026-10-25-migration-reconciliation.md`.
- Diferenças de grants dependentes da plataforma devem ser confirmadas em um Supabase equivalente,
  não inferidas somente do PGlite.
- Nenhum resultado local autoriza `db push`, `repair`, `reset`, replay ou alteração de permissões em
  produção.
