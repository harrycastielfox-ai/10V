# NEXO — avaliação da inteligência assistida

## Objetivo

Este documento registra a avaliação inicial da Prioridade 4 do roadmap do NEXO. A avaliação não autoriza o envio de dados operacionais a um provedor externo e não transforma a assistência local existente em uma IA generativa pronta para uso.

## Estado verificado

| Capacidade | Estado | Evidência e limite |
| --- | --- | --- |
| Leitura relacional da rede | Existente | `NexoIntelligenceBoard` calcula vínculos, confiança média, pendências de validação, pessoas sem vínculo e territórios com confiança baixa a partir do recorte carregado. |
| Síntese estruturada de pessoa | Existente, local | `buildNexoPersonIntelligenceSummary` organiza identificação, vínculos, procedimentos, territórios, documentos, cronologia e lacunas. Não chama modelo externo nem cria associação nova. |
| Cronologia rastreável | Existente, local | Eventos distinguem registro, documento e vínculo; datas ausentes não são inferidas. |
| Identificação de lacunas | Existente, local | A síntese aponta fotografia, documentos de identificação, localização e fontes de vínculos ausentes, sem converter ausência em fato negativo. |
| Comparação entre fontes | Planejado | Ainda não existe uma visão que apresente campos conflitantes, páginas e fontes lado a lado para revisão. |
| Minuta assistida de relatório | Planejado | O configurador permite selecionar dados e gerar relatório, mas não há geração textual por modelo nem trilha específica de revisão de uma minuta. |
| Provedor generativo externo | Não adotado | Não há autorização institucional, política de tratamento ou decisão sobre residência dos dados. Nenhum dado sensível deve ser enviado nesta fase. |

## Conclusão da avaliação

A base atual é suficiente para evoluir primeiro a assistência determinística e auditável, usando apenas os dados já carregados e as regras do NEXO. Ela ainda não é suficiente para habilitar um modelo generativo sobre dados reais. A próxima implementação deve começar por contratos de evidência, escopo e revisão, não por uma chamada de API de IA.

## Ordem recomendada para a próxima fase

1. **Contrato de evidência:** cada item de saída deve carregar `sourceType`, identificador da fonte, página quando houver, campo relacionado e nível de confirmação (`documentado`, `declaração`, `não confirmado`, `inferência` ou `hipótese`).
2. **Comparação explícita:** apresentar divergências sem escolher automaticamente a versão verdadeira; a decisão deve permanecer com o operador.
3. **Escopo e autorização:** permitir selecionar pessoa, organização, procedimento, fontes, fotos e observações antes de qualquer síntese ou minuta.
4. **Prévia editável:** a saída assistida deve ser rascunho, com revisão, edição, rejeição e confirmação humana antes de entrar em relatório ou cadastro.
5. **Auditoria reproduzível:** registrar usuário, data, recorte, fontes, versão/configuração do recurso e resultado aprovado ou rejeitado.
6. **Avaliação de privacidade:** decidir se o processamento será somente local ou se algum provedor externo poderá ser usado, com autorização institucional, retenção, localização, contrato e controles de acesso definidos.

## Matriz de riscos e controles

| Risco | Controle obrigatório antes de uso operacional |
| --- | --- |
| Alucinação ou preenchimento inventado | Responder `dados insuficientes` quando não houver evidência; proibir valores implícitos e exigir fonte por afirmação. |
| Associação interpretada como autoria ou participação | Exibir o vínculo e seu estado (`confirmado`, `provável`, `suspeito` ou `não confirmado`) sem elevar automaticamente o grau. |
| Vazamento de dados sensíveis | Manter processamento local até decisão institucional; bloquear envio externo por padrão e não registrar conteúdo sensível em logs. |
| Escopo excessivo | Montar o contexto somente com itens selecionados e autorizados pelo usuário; aplicar autenticação, permissões e RLS na origem. |
| Resposta não reproduzível | Guardar recorte, fontes, versão/configuração e revisão humana associada à saída. |
| Ação autônoma indevida | IA não exclui, salva, confirma vínculo, altera classificação ou publica relatório sem ação explícita e autorizada. |

## Critérios para considerar a IA assistida pronta para uma decisão de implementação

- Todas as afirmações relevantes da saída possuem referência verificável ou são marcadas como inferência/hipótese.
- Testes confirmam isolamento por usuário, permissão e recorte de dados.
- Documentos com campos contraditórios exibem as alternativas e suas páginas, sem seleção automática da verdade.
- O usuário pode editar, rejeitar ou abandonar a saída sem alterar o cadastro original.
- Há registro de auditoria suficiente para reproduzir o contexto da resposta.
- A política institucional aprova o modo de processamento e o eventual provedor.
- Uma avaliação humana documentada cobre qualidade, vieses, latência, custo e comportamento diante de dados insuficientes.

## Próxima decisão pendente

Definir se a primeira entrega será somente uma camada determinística local (comparação, citações e minuta baseada em campos selecionados) ou se, após a aprovação de privacidade, haverá um provedor generativo autorizado. Até essa decisão, a assistência local existente permanece a opção segura e verificável.

