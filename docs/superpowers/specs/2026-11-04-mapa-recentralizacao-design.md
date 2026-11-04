# Recentralização automática do mapa territorial

## Intenção

Manter Itabela como referência visual permanente no mapa territorial. Na visualização normal, o mapa deve retornar ao centro da cidade a cada 30 segundos, mesmo quando o usuário estiver movendo o mapa ou usando zoom.

## Comportamento

- O primeiro intervalo começa quando o mapa termina de carregar.
- A cada 30 segundos, a visualização retorna para `[-16.575, -39.559]`, zoom `15`.
- Zoom, arraste, seleção de endereço e clique em camadas não reiniciam nem cancelam o intervalo.
- O botão **Centralizar cidade** continua disponível e não reinicia o intervalo automático.
- A recentralização usa uma transição curta para deixar claro que foi uma ação automática.
- O temporizador é encerrado quando o mapa sai da tela, evitando trabalho em segundo plano e atualizações depois da desmontagem.

## Exceção de segurança operacional

No formulário **Adicionar local**, enquanto o usuário contorna ou circula uma área, não haverá recentralização automática. Deslocar o mapa durante a marcação pode posicionar o segundo clique em outra referência e produzir um território incorreto. Essa exceção não altera o comportamento rígido solicitado para a visualização normal.

## Abordagens consideradas

1. **Intervalo rígido de 30 segundos — escolhido.** Recentraliza mesmo com interação. Atende diretamente ao comportamento solicitado, com a exceção exclusiva do modo de desenho.
2. **Trinta segundos de inatividade — rejeitado.** Preserva a exploração manual, mas permite que o mapa permaneça fora da cidade por tempo indefinido durante interações frequentes.

## Verificação

O teste com relógio controlado deve confirmar que o mapa não recentraliza antes de 30 segundos, recentraliza ao completar o período mesmo após interação e cancela o temporizador ao desmontar. O modo de desenho deve permanecer estável além dos 30 segundos.
