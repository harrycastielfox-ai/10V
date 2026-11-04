# Organograma: cidade de atuação e controles

## Intenção

Registrar onde cada posição organizacional é exercida e tornar os controles do cartão do organograma previsíveis. Uma pessoa pode residir em uma cidade e exercer liderança em outra; por isso, a cidade pertence ao vínculo com a organização, não ao endereço pessoal.

## Comportamento aprovado

- Cada vínculo pode informar `município de atuação` e `UF de atuação`.
- O cadastro inicial, a criação de vínculo e o gerenciamento de posição permitem preencher e alterar esses campos.
- O cartão e o painel lateral mostram `Cargo · Município/UF`, omitindo separadores quando algum dado não existir.
- Cidade de atuação não é inferida pelo endereço, cargo, facção ou procedimentos.
- O primeiro botão do cartão expande/recolhe a ramificação, o segundo abre a gestão do vínculo e o terceiro abre o dossiê da pessoa. Todos recebem área clicável independente da navegação do canvas.
- A cada 15 segundos o canvas volta rigidamente ao enquadramento completo, mesmo após zoom ou movimento. A recentralização altera somente a câmera: busca, seleção, painel lateral e ramificações permanecem.
- O botão Ajustar à tela reutiliza a mesma função de enquadramento e não reinicia o intervalo.
- A animação respeita `prefers-reduced-motion`.

## Banco e auditoria

A evolução será incremental: duas colunas opcionais em `nexo_vinculos` (`municipio_atuacao` e `uf_atuacao`) e campos anterior/novo correspondentes em `nexo_hierarquia_eventos`. O gatilho existente deve registrar a mudança somente quando houver alteração real. A função `nexo_gerenciar_vinculo` continua `security invoker`, valida acesso pelo mecanismo existente e passa a receber os dois campos.

Nenhum dado atual será preenchido por dedução e nenhuma migration será executada em produção sem aprovação. Valores antigos permanecem nulos e continuam legíveis.

## Abordagens consideradas

1. **Campos no vínculo — escolhida.** Representa corretamente uma responsabilidade regional e permite que a mesma pessoa tenha contextos diferentes em organizações distintas.
2. **Reutilizar o endereço residencial — rejeitada.** Confunde local de moradia com área de responsabilidade e pode expor informação desnecessária no organograma.
3. **Inserir a cidade no texto do cargo — rejeitada.** Impede validação, filtros, auditoria e apresentação consistente.

Para a câmera, foi escolhido o intervalo rígido de 15 segundos porque o usuário pediu o mesmo comportamento do mapa territorial. A alternativa por inatividade foi descartada porque interações sucessivas poderiam adiar o retorno indefinidamente.

## Restrições e validação

- Sem dependências novas e sem mudanças nas permissões atuais.
- Município é texto opcional normalizado; UF é opcional, maiúscula e limitada a duas letras quando informada.
- A interface deve continuar funcional sem os novos campos, inclusive antes da migration em ambientes de demonstração.
- Testes cobrem serialização, persistência, auditoria SQL versionada, renderização do rótulo, os três botões e o ciclo rígido de 15 segundos.
