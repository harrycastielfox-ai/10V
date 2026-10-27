# Integração SQL isolada

Execute `pnpm install --frozen-lockfile` e `pnpm run test:integration` em Windows,
Linux ou macOS com Node. A suíte usa PostgreSQL compilado para WASM por PGlite,
em memória, sem URL, chave, conexão de rede ou credencial do Supabase.

`fixtures/database-bootstrap.sql` contém apenas pré-requisitos sintéticos.
As tabelas, RLS e RPCs de Vistorias são carregadas das migrations reais de
outubro; as propostas de Storage, RPCs privilegiadas e grants também são
executadas como SQL, sem transcrição dos seus corpos no teste. Os testes
trocam o papel para `authenticated` e configuram uma identidade sintética na
transação. A função `auth.uid()` é um adaptador do fixture, não o serviço Auth.

A suíte verifica:

- criação, revisão e associação de referência PDF via RPCs `SECURITY INVOKER`;
- histórico de versões e persistência SQL;
- bloqueio de contas suspensas, membros sem privilégio e sessão ausente;
- autorização de administrador/juiz na listagem de perfis;
- grants efetivos e `search_path` das funções privilegiadas;
- remoção de privilégios estruturais dos papéis de navegador;
- configuração privada, limites, MIME types e idempotência dos buckets;
- preservação das referências de objetos Storage preexistentes no fixture.
- filtro/contador de Objetos que reconhece a FK `inquerito_id`, preservando
  assinatura, ACL, cursor e filtros das funções originais.

Isso não valida GoTrue, emissão/renovação de JWT, PostgREST, requisições HTTP,
Storage binário, Edge Functions, uploads, acesso concorrente por conexões
independentes ou o esquema completo de NEXO. As tabelas NEXO do fixture são
substitutos mínimos para verificar grants; as policies NEXO não são testadas
por esses substitutos. Uma referência PDF sintética no banco não significa
que um PDF foi enviado ou recuperado do serviço Storage.

`object-procedure.test.ts` carrega os corpos originais das duas funções de
Objetos e da normalização de busca e os executa sobre uma tabela sintética.
A policy desse fixture é deliberadamente estreita para testar a preservação
de RLS invoker; ela não substitui a revisão das policies completas do módulo.

PGlite tem uma conexão exclusiva e pode usar versão de PostgreSQL diferente
da produção. O stack completo do Supabase e a versão alvo de PostgreSQL ainda
precisam de homologação própria. Consulte
`docs/recovery/2026-10-25-migration-reconciliation.md` para a preparação do
baseline que falta no histórico atual.
