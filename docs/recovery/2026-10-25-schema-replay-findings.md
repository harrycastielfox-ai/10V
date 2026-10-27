# Replay e baseline recuperado local — 25/10/2026

O modo **`recovered` aplica 121/121 migrations inalteradas e passa dez verificações de runtime**, com exit 0. É um **baseline recuperado candidato para homologação**, incluindo uma evolução documental temporal explícita. Não afirma que o histórico versionado sozinho é válido ou que o banco local equivale à produção.

Os controles que expõem a lacuna permanecem vermelhos: `bare` falha no primeiro arquivo e `legacy` aplica 117/121 arquivos antes de encontrar o retorno incompatível de RPC em `20261024123000_harden_privileged_rpcs.sql`. Ambos retornam exit 1. Nenhum teste converte essas falhas conhecidas em sucesso.

## Reprodução e artefatos

Somente Node e as dependências já presentes no checkout são necessários; nenhum pacote foi instalado por este experimento.

```powershell
node scripts/schema-replay/replay.mjs --mode=bare --write-report
node scripts/schema-replay/replay.mjs --mode=legacy --write-report
node scripts/schema-replay/replay.mjs --mode=recovered --write-report
```

O runner encontra o checkout pela própria localização e também aceita caminho absoluto a partir de outro diretório. `--write-report` grava `tests/schema-replay/results/<mode>.json`. Os relatórios registram versão do motor, hashes do runner/probes/fontes, inventário ordenado de todos os SQLs, arquivos aplicados, inserção documental, probes e primeiro erro. Não há credencial, URL ou conexão remota no runner.

O inventário inclui novas migrations dinamicamente: a correção de `normalize_vehicle_search` elevou o total de 120 para 121 durante este trabalho. Nomes SQL inesperados são rejeitados. O processo para no primeiro erro e descarta o banco em memória. `ddlComplete` comprova aplicação dos arquivos, `runtimeComplete` registra as verificações do modo recuperado e `complete` exige o conjunto aplicável ao modo escolhido.

## Fontes do schema inicial

| Fonte                                                    | Recorte / finalidade                                                            | Limite da evidência                                                                                                                                                                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/supabase-schema-proposta.sql`                      | Tabelas iniciais `inqueritos`/`representacoes`, enums, `profiles` e sua policy  | Proposta histórica, não snapshot de produção. Exclui `auditoria` obsoleto, pois o histórico cria essa tabela.                                                                                                                       |
| `supabase/2026-05-03_inqueritos_add_missing_columns.sql` | Colunas iniciais de inquéritos fora da pasta de migrations                      | SQL legado integral, com hash registrado.                                                                                                                                                                                           |
| `docs/proposta-padronizacao-campos-operacionais.sql`     | Colunas normalizadas/constraints de inquéritos e representações, linhas 100–195 | Recorte inalterado; exclui backfill de dados e a constraint de profiles que pressupõe coluna existente.                                                                                                                             |
| `docs/proposta-rls-representacoes-sigilosas.sql`         | Bloco completo de helpers/grants/RLS iniciais, linhas 109–292                   | Migrations posteriores continuam responsáveis pela evolução de sigilo. A função atual não é antecipada no tempo.                                                                                                                    |
| `docs/proposta-profiles-telefone.sql`                    | Somente bloco inicial que adiciona `telefone text null`                         | Não importa as demais RPCs da proposta.                                                                                                                                                                                             |
| `tests/schema-replay/catalog-prelude.sql`                | `set_updated_at()`, `profiles.funcao_institucional` e `inqueritos.visibilidade` | Função e metadados confirmados pelo pai em consulta somente leitura ao catálogo em 25/10/2026. Default de funcao_institucional não verificado. Visibilidade confirmada text/nullable/default NULL, sem constraint que a referencie. |
| `tests/schema-replay/platform-grants.sql`                | Somente USAGE de public e SELECT de profiles para authenticated                 | Confirmados no catálogo pelo pai. CREATE no schema e INSERT/UPDATE/DELETE em profiles confirmados false e verificados no runtime; sem ALL TABLES.                                                                                   |
| `tests/schema-replay/supabase-adapter.sql`               | Roles e superfícies SQL mínimas de Auth/Storage                                 | Adaptador parcial sem dados reais, GoTrue, APIs, assinatura, S3, trigger de protected-delete ou defaults/grants completos da plataforma.                                                                                            |

Os recortes são extraídos diretamente das fontes com linhas e hashes registrados. As reconstruções baseadas em metadados ficam separadas e com proveniência explícita. Nenhuma linha de registros de produção foi consultada pelo subagente.

PGlite `0.5.11` usa os módulos reais de `pgcrypto`, `pg_trgm` e `unaccent` distribuídos pelo pacote. A criação das extensões permanece no SQL original. As migrations completas, incluindo a nova correção veicular, e o probe de normalização foram executados; não foram substituídos por mocks.

## Evolução documental entre migrations

`20260518183000_fix_auditoria_rpc_ambiguous_id.sql` estabelece retornos sem `executor_avatar_path`. A proposta `20261024123000_harden_privileged_rpcs.sql` usa CREATE OR REPLACE com esse campo adicional. PostgreSQL rejeita a mudança dos OUT parameters com `42P13` porque ela altera o tipo de retorno existente.

`docs/auditoria-avatar-rpc-proposta.sql` documenta exatamente essa evolução, incluindo DROP/CREATE transacional e restauração dos grants. O modo `recovered` aplica seu bloco de aplicação inalterado imediatamente antes da proposta de endurecimento. A fase `documentary-gap`, fonte e hash aparecem separadamente no manifesto. Não há DROP ad hoc, CASCADE, reescrita de migration ou remoção de policy para passar.

**Decisão de recuperação:** o pai autorizou explicitamente esse modo adicional com base no bloco documental de evolução dos OUT parameters e no contrato remoto observado. O custo de uma suposição temporal errada é um baseline que difere da produção; por isso **paridade de catálogo continua pendente**. `legacy` preserva a evidência de que o histórico isolado é incompleto. A data exata de aplicação do documento em produção não foi estabelecida.

## Cadeia de bloqueios observados

| Etapa                                              |  Arquivos aplicados | Primeiro bloqueio                                                                                       |
| -------------------------------------------------- | ------------------: | ------------------------------------------------------------------------------------------------------- |
| Banco vazio                                        |                   0 | `42P01` em `20260504120000_fix_inqueritos_soft_delete_rls.sql`: falta inqueritos                        |
| Prelude documental inicial                         |                  12 | `42883` em `20260713170000_security_hardening.sql`: falta set_updated_at()                              |
| Com trigger auxiliar confirmado                    |                  15 | `42703` em `20260715110000_inquerito_pessoas_and_aafai.sql`: falta tipo_procedimento_normalizado        |
| Com contrato normalizado                           |                  18 | `42883` em `20260730120000_consolidate_security_grants.sql`: falta helper de representações             |
| Com autorização inicial documentada                |                  20 | `42703` em `20260731100000_harden_inqueritos_visibilidade_rls.sql`: falta visibilidade                  |
| Com visibilidade confirmada, legacy atual          |             117/121 | `42P13` em `20261024123000_harden_privileged_rpcs.sql`: retorno de list_auditoria(integer) incompatível |
| Com evolução documental, primeira rodada recovered |         121/121 DDL | Runtime `42501`: falta SELECT em profiles, privilégio de plataforma ausente do histórico                |
| Com privilégio mínimo confirmado, recovered atual  | 121/121 + 10 probes | Nenhum erro; exit 0 como candidato recuperado                                                           |

Falhas diferentes identificaram dependências diferentes. A execução continuou enquanto havia fonte suficiente. Os três snapshots intermediários existentes preservam os hashes daquelas rodadas e não são o manifesto atual. Nenhum snapshot adicional por erro foi criado após a continuação. No relatório legacy atual, quatro arquivos restantes incluem o que falhou e três não tentados.

## Runtime do schema completo recuperado

As verificações usam apenas identidades/payloads sintéticos e funções/policies reais do histórico completo:

1. Grants mínimos: uso do schema e leitura de profiles permitidos; CREATE no schema e escrita direta em profiles negados.
2. Três identidades sintéticas: admin autorizado, membro autorizado e admin bloqueado.
3. A policy real de profiles restringe SELECT ao próprio usuário.
4. Diretório administrativo executa com contrato final, incluindo telefone/função institucional.
5. Membro e admin bloqueado recebem 42501 no diretório administrativo.
6. As três RPCs de auditoria executam e expõem executor_avatar_path.
7. As três RPCs de auditoria negam admin bloqueado com 42501.
8. Na tabela real NEXO, admin cria/lê a pessoa; membro/admin bloqueado veem zero linhas e recebem 42501 ao inserir.
9. A RPC nexo_criar_pessoa_completa usada pelo frontend recebe request_id e pessoa.nome sintéticos, devolve o mesmo id no retry e mantém uma única linha; membro/admin bloqueado recebem 42501, inclusive repetindo o request_id existente.
10. Normalização veicular: `AÇÃO  VISÍVEL` vira `acao visivel`; NULL vira texto vazio.

DDL completo não prova correção de todos os corpos PL/pgSQL, cobertura completa de RLS ou equivalência com Supabase. Os testes de integração recortados continuam separados. Permanecem pendentes paridade de catálogo e validação funcional ampliada em homologação.

## Verificação e escopo

- Sintaxe Node e lint direcionado dos arquivos JavaScript: aprovados.
- Execução real: bare/legacy retornam 1; recovered retorna 0 com 121/121 e dez probes.
- Relatórios com hashes permitem comparação determinística entre novas execuções.
- Repetição final de recovered a partir de outro diretório: exit 0, 121/121 e 10/10 probes, com relatório byte a byte idêntico; SHA-256 `d678c9515259775e0a41ddd654ce20a43f34ad926d18320c722174eb93d7c55a`.
- Nenhuma migration histórica, pacote, lockfile ou configuração foi alterada pelo subagente; nenhuma instalação, commit, chamada de produção ou suíte global foi executada por ele.
