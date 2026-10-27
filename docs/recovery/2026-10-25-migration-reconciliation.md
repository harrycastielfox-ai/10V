# Reconciliação de migrations e homologação isolada

## Estado confirmado

A produção permanece intocada. A comparação somente leitura do histórico
encontrou 92 migrations remotas: 49 têm nome e timestamp iguais aos locais e
43 têm o mesmo nome com timestamp diferente. Todas as remotas têm um nome
correspondente no checkout. Antes das propostas desta recuperação, 24 arquivos
locais não tinham registro remoto correspondente.

Nome ou timestamp iguais não provam conteúdo igual. O comparador em
`scripts/migrations/sql-lexical.mjs` agora tokeniza o SQL e ignora comentários
e espaços somente fora de literais, preservando strings, identificadores
quoted, dollar quotes e limites de comandos. Os 92 pares foram classificados
como 80 lexicamente iguais, 11 diferentes e um inconclusivo. Sete das 11
diferenças são apenas CRLF/LF dentro de literais; permanecem diferentes por
critério conservador. Treze testes verificam o comparador e sua CLI.

O relatório seguro `scripts/migrations/reconciliation-2026-10-25.json` contém
nomes, versões, hashes e categorias, sem os corpos SQL remotos. As diferenças
restantes incluem um corpo de normalização de busca e strings de seed com
codificação corrompida, statements locais de índice/policies que não constam
no registro remoto e um marcador descritivo no lugar do SQL aplicado.
Essas ausências no histórico não provam ausência dos efeitos atuais: por
exemplo, o catálogo remoto já possui as policies DELETE dos documentos NEXO.
Não foram exportados dados de aplicação nem corpos de migrations remotas para
artefatos públicos. A reconciliação dos efeitos finais continua pendente.

Também há inversões de ordem. Por exemplo, `nexo_organization_gallery` está
em `20261021143000` localmente e `20261021115332` no remoto; isso muda sua
posição relativa a outras migrations do NEXO. Renomear arquivos para os
timestamps remotos sem analisar dependências não é uma solução segura.

## Por que o replay completo ainda não é reproduzível

O primeiro arquivo versionado, `20260504120000_fix_inqueritos_soft_delete_rls.sql`,
já altera `public.inqueritos`. As definições iniciais de `inqueritos`,
`profiles` e enums não estão no diretório de migrations. Existe uma proposta
histórica em `docs/supabase-schema-proposta.sql`, mas ela não foi comprovada
equivalente ao esquema atual. Logo, instalar Docker e executar um reset local
não basta para produzir um backend equivalente à produção.

O host Windows atual tem Node/pnpm, mas não Docker, Podman, PostgreSQL nativo
ou WSL operacional. Além dos testes SQL recortados, há agora um candidato a
baseline recuperado: `pnpm run test:schema` executa todos os SQLs atuais, com
dependências iniciais e uma evolução documental de contrato explicitamente
rastreadas por fonte/hash. Ele também executa verificações de perfil, RLS e
RPCs no esquema resultante. Os modos estritos `bare` e `legacy` continuam
expondo as falhas históricas; o modo `recovered` não as apaga do diagnóstico.
Veja `2026-10-25-schema-replay-findings.md` e `tests/schema-replay/README.md`.
Esse candidato não prova equivalência com o catálogo produtivo e ainda usa
adaptadores SQL de Auth/Storage, sem os serviços reais do Supabase.

## Sequência de reconciliação

1. Manter o histórico de produção congelado durante a análise. Não executar
   `db push`, `db reset`, `migration repair`, replay ou renomeação automática.
2. Obter um snapshot apenas de esquema, sem registros, credenciais ou usuários,
   revisando funções, grants, policies, triggers e dependências. Conferir o
   snapshot contra o catálogo remoto. Esse artefato deve passar por revisão
   antes de entrar no repositório público.
3. Construir um baseline separado de homologação a partir desse esquema.
   Preservar o histórico legado para rastreabilidade; não reescrevê-lo como
   efeito colateral da criação do baseline.
4. Comparar cada um dos 92 pares por statements e efeitos finais no catálogo,
   explicando diferenças de comentários, delimitadores e alterações reais.
   Para os arquivos locais sem registro, verificar se seus efeitos já existem
   em produção antes de propor qualquer aplicação.
5. Revisar a ordem/dependência das migrations com timestamps divergentes.
   Não marcar um arquivo como aplicado só por ter o mesmo nome.
6. No Supabase isolado, aplicar apenas o baseline e a sequência reconciliada.
   Criar usuários e registros inteiramente sintéticos. Configurar o segredo
   local de rate limit e as Edge Functions necessárias ao login.
7. Executar os fluxos de login/logout, cargos, CRUD, vínculos, auditoria,
   Storage e documentos pelo Playwright com chaves do próprio stack local.
8. Apresentar o lote SQL aprovado e seu plano de recuperação para autorização
   explícita antes de qualquer mudança produtiva.

## Propostas desta recuperação

- `20261024111500_restore_required_storage_buckets.sql`: somente os três
  buckets ainda utilizados pelo aplicativo; não recria Localização.
- `20261024123000_harden_privileged_rpcs.sql`: exige conta autorizada nas cinco
  RPCs privilegiadas e rejeita função institucional nula na checagem de acesso.
- `20261025022835_harden_data_api_table_grants.sql`: explicita privilégios
  necessários ao frontend e às RPCs invoker. Vistorias preserva
  `SELECT, INSERT, UPDATE` nas duas tabelas; remover DML quebraria as RPCs.
- `20261025070926_fix_objects_without_procedure.sql`: inclui `inquerito_id`
  nas verificações de ausência de procedimento, preservando contratos das
  funções, grants e RLS invoker.
- `20261025123642_restore_vehicle_search_normalization.sql`: restaura a
  normalização de acentos e mantém a busca em textos legados sem backfill.
  O custo por linha permanece para homologação; não acrescenta índice.

Os testes isolados executam essas propostas e um recorte das migrations
originais. Nenhuma foi aplicada no Supabase remoto. As demais propostas
incrementais devem ser incluídas no mesmo processo de revisão e homologação.

## CI completo

Um job Linux pode subir Supabase local sem criar infraestrutura faturada,
mas deve consumir um baseline reproduzível antes de iniciar E2E autenticado.
Até esse baseline existir, a CI executa unitários, integração SQL PGlite,
build e smoke tests de navegador. Não deve anunciar cobertura de integração
Auth/PostgREST/Storage que não foi executada.
