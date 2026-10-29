# NEXO Organograma como árvore fixa

## Intenção

O organograma deve ser percebido como uma árvore hierárquica incorporada ao dossiê, e não como um mapa ou canvas navegável.

## Decisão aprovada

- Remover os botões `Ajustar à tela` e `Tela cheia`.
- Remover os controles flutuantes de zoom e enquadramento.
- Impedir zoom, panorâmica por arraste, panorâmica por rolagem e zoom por gesto ou duplo clique.
- Manter o enquadramento automático inicial para a árvore caber na área disponível.
- Manter busca, destaque, expansão/recolhimento, cartões, linhas, painel lateral e abertura dos perfis.
- A busca seleciona e destaca o integrante sem deslocar ou ampliar a árvore.

## Abordagem

Manter `@xyflow/react` apenas como mecanismo de layout e renderização das conexões. A viewport será configurada como uma apresentação estática, sem controles ou gestos de navegação. Isso preserva a estrutura atual, evita uma segunda implementação da árvore e reduz o risco de regressão.

## Não objetivos

- Não alterar dados, relações hierárquicas ou persistência.
- Não modificar as demais abas do dossiê.
- Não trocar a biblioteca nesta correção.

## Aceite

Na rota de pré-visualização, a árvore continua completa e funcional, mas não exibe controles de mapa nem responde a gestos de zoom/pan. A busca continua abrindo o painel correto e não altera o enquadramento da árvore.
