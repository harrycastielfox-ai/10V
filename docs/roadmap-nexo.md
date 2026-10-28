# NEXO — roadmap estratégico

Este documento é a referência estratégica de longo prazo do módulo NEXO. Ele organiza prioridades, dependências, limites e critérios de aceite para futuras evoluções. Não autoriza a implementação automática de todas as iniciativas descritas: cada uma exige análise técnica, definição de escopo, validação de segurança e aprovação própria.

## 1. Visão estratégica

O NEXO deve evoluir para uma plataforma de organização, consulta e análise de informações investigativas, integrando cadastros de pessoas, organizações, territórios, procedimentos, veículos, vínculos, documentos, fotografias e relatórios.

A evolução deve priorizar:

- confiabilidade dos dados e das operações de salvamento;
- redução do retrabalho durante os cadastros;
- rastreabilidade da origem das informações;
- facilidade de consulta e identificação de pendências;
- geração de documentos profissionais a partir dos dados existentes;
- inteligência assistida por IA, com fontes verificáveis e revisão humana;
- segurança, controle de acesso e preservação das funcionalidades atuais.

O roadmap orienta decisões futuras; não substitui especificações técnicas, contratos de dados, políticas institucionais ou critérios de autorização de uma entrega.

## 2. Princípios e limites de desenvolvimento

1. **Dados antes de aparência.** Indicadores e conclusões devem corresponder aos registros acessíveis e às regras explicáveis do sistema.
2. **Fonte e contexto.** Dados cadastrais, declarações, documentos, análises e hipóteses devem permanecer distinguíveis, com origem preservada quando disponível.
3. **Revisão humana.** Importações, divergências, possíveis duplicidades, vínculos e textos assistidos devem ser conferidos por usuário autorizado antes de se tornarem informação definitiva.
4. **Ausência não é negativa.** Campo vazio, fotografia ausente ou fonte não localizada não pode ser convertido automaticamente em “não possui”, “sem restrição” ou conclusão semelhante.
5. **Segurança por padrão.** RLS, autenticação, escopo de dados, auditoria e armazenamento privado são requisitos de evolução, não melhorias opcionais.
6. **Compatibilidade operacional.** Mudanças devem preservar cadastro manual, consulta, edição, vínculos, fotografias, exclusão lógica e relatórios já disponíveis, salvo decisão registrada em sentido contrário.
7. **Transações e recuperação.** Salvamentos devem ser idempotentes e recuperáveis; falhas de upload, rede ou processamento não podem gerar duplicação ou perda silenciosa.
8. **IA assistiva.** A IA não confirma vínculos, classifica pessoas, exclui registros nem toma decisões investigativas sem ação explícita e autorizada do profissional.
9. **Dados sensíveis sob controle.** Nenhum dado operacional sensível deve ser enviado a serviço externo sem autorização institucional, avaliação de privacidade e registro da decisão.
10. **Escopo incremental.** Cada iniciativa deve ter escopo, evidências e critérios de aceite próprios. Não há datas artificiais neste roadmap.

## 3. Estado atual verificado

Os estados abaixo refletem a inspeção do código, dos testes e dos documentos existentes nesta revisão. A presença de uma capacidade nesta seção não significa que toda a iniciativa correspondente esteja concluída.

| Capacidade | Estado | Evidência observada |
| --- | --- | --- |
| Cadastro manual e por Anexo PDF | Existente | `NexoCreateDialog`, `NexoPersonWizard` e `NexoPdfImportPanel` oferecem os dois fluxos. |
| Leitura textual de PDF no navegador | Existente | Limites de 15 MB e 30 páginas, prévia e revisão dos campos. |
| OCR local opcional | Existente | O fluxo informa a limitação de documentos digitalizados e permite processamento local. |
| Extração e escolha de imagens incorporadas | Em validação | Há candidatos de imagem e escolha entre perfil, relatório ou não importar; o fluxo ainda precisa de regressão abrangente para PDFs variados. |
| Persistência do documento-fonte, hash, páginas, OCR e candidatos | Existente | `nexoPdfImport.ts` e `nexoRepository.ts` persistem metadados e seleção revisada conforme a arquitetura atual. |
| Cadastros de pessoas e organizações, edição e exclusão lógica | Existente | Dossiês, diretórios, repositórios e RPCs transacionais existentes. |
| Vínculos, hierarquia, territórios, veículos, observações e procedimentos | Existente | Componentes do workspace e repositórios do NEXO. |
| Organograma hierárquico interativo | Entrega inicial implementada | Aba no dossiê de facção, projeção por `superior_vinculo_id`, busca, navegação, tela cheia, painel contextual e testes com dados sintéticos. |
| Busca, dashboard, rede relacional e possíveis duplicidades | Existente | `NexoCommandDashboard`, filtros, diretório e testes de duplicidade. |
| Configuração de seções, fotos e observações para relatórios | Existente | `NexoReportConfigurator` e `NexoReportsHub`. |
| Emissão profissional, arquivada e reproduzível de relatórios | Em validação | O modo de impressão/PDF existe, mas a emissão ainda não é arquivada com recorte, versão e metadados reproduzíveis. |
| Painel operacional unificado de pendências | Planejado | Existem regras e contratos de indicadores relacionados, mas não um fluxo único com resolução contextual de todas as categorias. |
| Síntese, cronologia, comparação e minuta assistidas por IA | A avaliar | `NexoIntelligenceBoard` existe como base de inteligência, porém a camada assistida precisa de requisitos de fonte, segurança, avaliação e governança. |

A correção recente para preservar e exibir a fotografia extraída do PDF é uma **estabilização pontual do fluxo atual**. Ela não representa a conclusão do planejamento completo de importação documental descrito na Prioridade 1.

### 3.1 NEXO Organograma 2.0

As fases 1 e 2 foram entregues em 27/10/2026 como evolução do dossiê existente. A primeira entrega é somente de leitura estrutural e reutiliza pessoas, organizações, fotografias, vínculos, chefia, status, confiança e os fluxos atuais de perfil e gestão.

Foram concluídos: aba Organograma, canvas navegável, todos os integrantes atuais elegíveis, posição não determinada para raízes sem chefia válida, busca e foco, ramificações recolhíveis, painel lateral, tela cheia e regressões automatizadas. Nenhuma migration foi necessária.

Permanecem para branches e PRs próprios: núcleos/setores persistidos e edição segura (fase 3), rede de relações não hierárquicas (fase 4) e exportação PDF/refinamentos de escala (fase 5).

## 4. Iniciativas prioritárias

### Prioridade 1 — Importação de PDF completa e confiável

**Estado:** Em validação  
**Objetivo:** tornar consistente o fluxo desde a leitura do PDF até a conferência, o preenchimento do formulário e o salvamento definitivo.

**Direção planejada**

- Extrair campos cadastrais com valor original, normalização, origem e página.
- Identificar imagens e permitir seleção humana, com prévia automática no cadastro, remoção e substituição.
- Preservar a finalidade de cada fotografia: perfil, exclusiva de relatório ou não importar.
- Manter o documento original, hash, arquivo, página, versão do extrator e demais metadados aplicáveis.
- Usar OCR local para documentos digitalizados, respeitando limites, erros compreensíveis e as limitações já documentadas.
- Tratar múltiplas imagens, várias pessoas, dados contraditórios, PDFs inválidos, protegidos, vazios, grandes ou corrompidos.
- Exigir revisão humana dos campos, fontes, imagens, possíveis duplicidades e atribuição da pessoa antes da gravação.
- Persistir campos, fotografias, alegações revisadas e documento original de forma transacional e idempotente.
- Criar regressões de imagens, campos, persistência, reabertura, falhas parciais e compatibilidade com o cadastro manual.

O detalhamento técnico permanece em [`nexo-pdf-cadastro-plano.md`](nexo-pdf-cadastro-plano.md). Este roadmap consolida a prioridade e seus critérios sem substituir aquele plano.

**Dependências e riscos:** contratos de documento-fonte e alegações; Storage privado e RLS; memória e tempo de processamento no navegador; classificação incorreta de imagens; PDFs com várias pessoas; perda de seleção entre etapas; regressão no fluxo manual; exposição indevida de conteúdo em logs.

**Critérios objetivos de aceite**

- Uma importação pode ser acompanhada da prévia até a reabertura do cadastro salvo.
- Cada campo e imagem selecionados conserva sua origem, página e finalidade quando aplicável.
- A foto escolhida aparece no cadastro após confirmação, pode ser substituída ou removida e não é trocada automaticamente por outra.
- PDFs textuais, digitalizados, com múltiplas imagens, contraditórios e inválidos produzem resultado verificável ou erro compreensível.
- Falhas de rede, upload ou persistência não criam duplicata nem deixam seleção silenciosamente perdida.
- Testes de regressão demonstram que correções de importação não quebram cadastros manuais.

**Indicadores verificáveis:** casos de teste aprovados por tipo de PDF; taxa de reabertura com campos e fotos preservados; ausência de duplicatas em reexecução; cobertura de erros e RLS; inspeção visual da prévia e dos registros reabertos.

### Prioridade 2 — Painel de pendências cadastrais

**Estado:** Planejado  
**Objetivo:** transformar problemas de completude e qualidade em uma lista operacional de ações, sem inventar informação negativa.

**Direção planejada**

O painel deverá identificar, conforme dados e regras existentes:

- pessoas sem fotografia de perfil;
- campos essenciais ausentes quando pertinentes ao tipo de cadastro;
- localização ausente ou incompleta;
- vínculos sem fonte ou ainda não confirmados;
- informações documentais que exigem conferência;
- possíveis duplicidades para análise;
- falhas de persistência efetivamente identificadas.

Deverá exibir quantidade por categoria, permitir abrir a listagem, filtrar, pesquisar e acessar o cadastro correto, resolver a pendência preservando dados já preenchidos, distinguir obrigação de recomendação e recalcular os indicadores após a correção. As regras devem evitar contagens duplicadas, respeitar permissões e ser explicáveis.

**Dependências e riscos:** contrato de indicadores existente; paginação e escopo de acesso; definição institucional de campos essenciais; resolução de duplicidades; risco de transformar ausência em suspeita ou de contar a mesma pendência mais de uma vez.

**Critérios objetivos de aceite**

- Cada indicador corresponde aos registros efetivamente consultados pelo usuário.
- Selecionar um indicador abre a categoria, o cadastro e o contexto que originaram a pendência.
- A correção pode ser feita sem redigitar dados já existentes e atualiza os indicadores.
- Obrigatório e recomendação são visualmente e semanticamente distintos.
- Um registro com ausência legítima não é classificado como fato negativo.

**Indicadores verificáveis:** amostras de contagem conferidas contra consulta de origem; zero duplicidade na mesma categoria; testes de permissões; tempo de atualização após correção; jornada completa de abrir, corrigir e retornar ao painel.

### Prioridade 3 — Gerador profissional de relatórios

**Estado:** Em validação  
**Objetivo:** evoluir o configurador e a emissão existentes para relatórios profissionais, consistentes, configuráveis e conferíveis.

**Direção planejada**

O gerador deve permanecer integrado ao configurador atual e permitir selecionar pessoa, organização ou recorte geral; identificação e síntese cadastral; vínculos e confirmação; procedimentos; territórios; veículos; observações; fotografias; documentos de origem; e seções do relatório.

Para PDF A4, deve oferecer capa conforme modelo aprovado, hierarquia visual, margens, paginação, legendas, identificação e origem de fotos, anexos fotográficos/documentais, quebras de página controladas, prévia antes da exportação e metadados adequados ao documento.

O conteúdo deve diferenciar dados cadastrais, declarações de fontes, informações documentais e análises; preservar referências; mostrar ausência sem inventar valores; não converter vínculo suspeito em fato confirmado; e não produzir conclusão jurídica automática.

**Dependências e riscos:** estabilidade da importação e das fontes; seleção de fotos/observações; renderização A4; paginação e imagens de tamanhos variados; armazenamento de emissões; associação incorreta entre legenda, imagem e fonte.

**Critérios objetivos de aceite**

- Relatórios curtos e longos, com e sem fotografias, são conferidos visualmente em todas as páginas.
- Nenhuma imagem é cortada, separada de sua legenda, repetida indevidamente ou associada à fonte errada.
- Prévia e arquivo exportado exibem o mesmo recorte e as mesmas seções selecionadas.
- Ausência de dado é explícita e não recebe valor inventado.
- A emissão pode ser identificada por autor, data, recorte, seções, fotografias e versão aplicável quando arquivada.

**Indicadores verificáveis:** checklist visual aprovado por cenário; zero páginas vazias ou conteúdo cortado nos casos de regressão; conferência de referências; reprodutibilidade do relatório arquivado; testes de seleção e exclusão de fotos/observações.

### Prioridade 4 — Inteligência assistida por IA

**Estado:** A avaliar  
**Objetivo:** organizar informações já existentes e apoiar análises e relatórios somente depois da estabilização dos dados, documentos, permissões e rastreabilidade.

**Direção planejada**

- **Síntese de dossiês:** identificação, vínculos, procedimentos, territórios, veículos e observações pertinentes.
- **Cronologia:** ordenar eventos, distinguindo data do fato, do documento e do registro quando disponíveis.
- **Comparação:** apontar divergências entre documentos, cadastros e fontes sem escolher automaticamente a verdade.
- **Assistência a relatórios:** gerar minuta apenas dos dados autorizados e selecionados, sempre editável antes da exportação.
- **Lacunas informacionais:** indicar ausências, inconsistências e questões para conferência, sem inventar dados ou conexões.

Toda informação relevante deverá manter referência à fonte quando disponível. Fatos documentados, declarações, dados não confirmados, inferências e hipóteses devem ser rotulados separadamente. A análise final continuará sob responsabilidade do profissional autorizado.

**Dependências e riscos:** dados suficientemente confiáveis; referências consistentes; autenticação, permissões e RLS; política institucional para processamento; escolha de provedor; vazamento de dados sensíveis; alucinação ou excesso de confiança; associação indevida interpretada como autoria; impossibilidade de reproduzir uma resposta sem versão/configuração.

**Requisitos obrigatórios de segurança e governança**

- respeitar escopo autorizado, autenticação, permissões e RLS;
- avaliar processamento local ou externo antes de selecionar provedor;
- não enviar dados sensíveis a serviços externos sem autorização prévia;
- auditar operações relevantes, fontes consultadas e versão/configuração quando viável;
- informar quando faltarem dados para conclusão confiável;
- não excluir, confirmar, classificar ou decidir sem ação autorizada do usuário.

**Critérios objetivos de aceite**

- Cada saída relevante aponta as fontes e deixa claro o nível de confirmação.
- Testes demonstram separação entre fato, declaração, inferência e hipótese.
- Usuários sem permissão não recebem dados ou referências fora de seu escopo.
- O usuário consegue revisar, editar, rejeitar e não publicar a saída da IA.
- Avaliação de privacidade, segurança, qualidade e rastreabilidade é aprovada antes de uso operacional.

**Indicadores verificáveis:** cobertura de citações; taxa de respostas recusadas por falta de dados; testes de isolamento por perfil; registros de versão/configuração; avaliação humana documentada; ausência de ações autônomas proibidas.

## 5. Dependências e ordem de execução

A ordem recomendada é:

1. estabilização e validação da importação por PDF;
2. painel de pendências cadastrais;
3. aperfeiçoamento do gerador profissional de relatórios;
4. inteligência assistida por IA.

A Prioridade 2 depende de regras de completude e persistência confiáveis. A Prioridade 3 depende de dados, fotografias, observações e fontes selecionáveis, além de uma importação estável. A Prioridade 4 depende de todas as anteriores, de permissões validadas e de política aprovada para processamento de dados sensíveis.

Esta sequência não aprova a execução das fases nem estabelece prazos. Cada iniciativa deve passar por análise técnica, definição de escopo, revisão de segurança e critérios de aceite antes de entrar em desenvolvimento.

## 6. Pendências que exigem decisão futura

- Quais campos serão formalmente obrigatórios por tipo de cadastro e quais serão apenas recomendações.
- Qual política institucional regerá retenção, backup, restauração e exclusão de documentos e fotografias.
- Quais versões de modelo de relatório serão aprovadas e como suas alterações serão versionadas.
- Quando uma emissão de relatório deve ser arquivada e quem pode reabri-la ou anulá-la.
- Quais provedores, se algum, poderão processar dados sensíveis e em quais condições.
- Qual vocabulário institucional diferenciará fato documentado, declaração, dado não confirmado, inferência e hipótese.
- Como serão avaliadas qualidade, vieses, custo, latência e reprodutibilidade de recursos de IA.
- Quais perfis poderão consultar, corrigir, exportar e auditar cada categoria de dado.

## 7. Documentos e evidências de referência

- [`nexo-pdf-cadastro-plano.md`](nexo-pdf-cadastro-plano.md): plano técnico detalhado de cadastro por PDF, fontes, imagens, OCR, persistência e relatório em duas partes.
- [`nexo-prontidao-uso-diario.md`](nexo-prontidao-uso-diario.md): critérios operacionais, integridade, recuperação, qualidade e lacunas para uso diário.
- [`visao-produto-sied.md`](visao-produto-sied.md): visão institucional, segurança, auditoria e preferência por dados reais e indicadores explicáveis.
- [`central-pendencias-contrato-indicadores.md`](central-pendencias-contrato-indicadores.md): contrato de indicadores e limites para não inventar métricas.
- [`nexo-ia-assistida-avaliacao.md`](nexo-ia-assistida-avaliacao.md): avaliação inicial da assistência local, riscos, gates de segurança e decisões pendentes para IA generativa.
- `NexoWorkspacePage.tsx`, `NexoCreateDialog.tsx`, `NexoPdfImportPanel.tsx`, `NexoPersonWizard.tsx`, `NexoDossier.tsx`, `NexoReportConfigurator.tsx`, `NexoReport.tsx`, `NexoReportsHub.tsx`, `NexoIntelligenceBoard.tsx`, `nexoPdfImport.ts` e `nexoRepository.ts`: componentes e camadas verificadas para o estado atual.
- Testes de importação, wizard, dossiê, repositório, duplicidades, dashboard, diretório, relatórios, rotas, filtros e inteligência: evidência de comportamento existente e base para regressões futuras.

## 8. Escopo desta documentação

Este roadmap registra o estado verificado, incluindo a entrega inicial do Organograma 2.0. Ele não autoriza automaticamente fases futuras, migrations, publicação ou alterações de segurança e não substitui decisões anteriores que continuem válidas.
