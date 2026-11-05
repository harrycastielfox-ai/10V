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

---

# Design QA — Central NEXO com mapa territorial

- Referência: `codex-clipboard-cf1b478f-9368-404d-aef4-efd2a2aa72eb.png`
- Rota verificada: `http://127.0.0.1:4173/preview/nexo`
- Capturas: `test-results/nexo-central-sem-acesso-rapido.png`, `test-results/nexo-central-map-v2.png` e `test-results/nexo-central-tablet.png`
- Viewports: 1680 × 1050, 1366 × 768 e 768 × 1024

## Comparação

- O destaque da Central conserva somente as ações `Cadastrar pessoa` e `Cadastrar facção`.
- Os quatro indicadores continuam visíveis e usam as contagens persistidas de pessoas, facções, áreas e procedimentos.
- O painel de pendências foi substituído pelo mapa de ruas já usado pelo NEXO.
- O bloco `Acesso rápido / Cadastros recentes` foi removido e o mapa passou a ocupar toda a largura abaixo dos indicadores.
- As organizações com áreas ganham legenda com sigla/nome e sua cor cadastrada.
- Os limites territoriais usam os polígonos persistidos; nenhum domínio territorial é inferido automaticamente.
- A seleção de legenda ou polígono abre o dossiê da facção relacionada.

## Responsividade

- Não houve overflow horizontal nos três viewports verificados.
- Em notebook, o mapa usa toda a largura útil sem deixar uma coluna vazia.
- Em tablet, os painéis passam para uma coluna e o mapa preserva controles e altura útil.

## Pendências

O ambiente local atualmente possui zero áreas persistidas; por isso a captura visual valida o mapa-base e o estado sem legenda. A renderização de cores, siglas e contagens foi coberta com territórios sintéticos nos testes automatizados.

final result: passed
