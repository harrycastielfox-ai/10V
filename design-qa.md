# Design QA — rodapé temático de liderança

- Referência: `codex-clipboard-218206fe-130e-4a15-a70b-dfd64433efe0.png`
- Rota verificada: `http://127.0.0.1:4173/preview/nexo`
- Estado: dossiê sintético, aba Organograma, cartão de liderança visível
- Capturas: `test-results/organogram-theme-qa-final.png` e `test-results/organogram-theme-cyan-qa.png`

## Comparação

- A antiga borda laranja fixa foi removida.
- O rodapé inteiro usa a cor cadastrada para a facção.
- Texto e ícones escolhem contraste claro ou escuro pelo cálculo WCAG.
- Altura, espaçamento, truncamento e três controles do cartão foram preservados.
- A variação ciano foi conferida visualmente e corresponde à intenção indicada na referência.

## Interação

- Fora da tela cheia: roda, `Ctrl` + roda e gesto de pinça não alteram o zoom do canvas.
- Fora da tela cheia: a roda continua rolando o dossiê.
- Em tela cheia: roda e gesto de pinça controlam o zoom.
- Botões de zoom permanecem disponíveis nos dois modos.

## Pendências

Nenhuma divergência P0, P1 ou P2 identificada.

final result: passed
