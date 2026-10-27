# NEXO Organograma 2.0 — Fases 1 e 2

## Intenção

Entregar uma primeira versão utilizável do organograma investigativo dentro do dossiê de cada facção, consumindo os cadastros e vínculos hierárquicos já persistidos. A visualização deve facilitar leitura, navegação e abertura de perfis sem inferir liderança a partir de cargos e sem modificar registros.

## Escopo desta entrega

- Nova aba **Organograma** somente no dossiê de organização.
- Canvas com zoom, pan, ajuste à tela, centralização, minimapa e modo tela cheia.
- Todos os vínculos atuais elegíveis (`status !== "desvinculado"`) representados.
- Relações vindas exclusivamente de `superior_vinculo_id`.
- Integrantes sem superior válido agrupados sob **Posição não determinada**, sem classificação automática como liderança.
- Busca por nome ou alcunha, destaque, revelação da ramificação e centralização.
- Expansão e recolhimento de ramificações.
- Cartões compactos com foto existente, nome, alcunha, função, status, confiança e ações de perfil/gestão.
- Painel lateral contextual com informações estritamente necessárias.
- Estados vazio, erro e carregamento na API do componente.

## Fora do escopo

- Escrita ou migration de banco.
- Núcleos/setores persistidos, edição estrutural por arraste, rede não hierárquica e exportação PDF.
- Deploy no Cloudflare ou aplicação de migrations remotas.
- Classificação automática de pessoas, organizações ou vínculos.

## Restrições

- Preservar dashboard, demais abas e fluxos atuais.
- Reutilizar `NexoPessoa`, `NexoVinculo`, `getNexoPersonPhotoUrl`, `onOpen` e `onManageLink`.
- Não duplicar fotos nem dados.
- O canvas é somente leitura estrutural; nenhum movimento visual persiste alterações.
- Respeitar a identidade visual existente, teclado e `prefers-reduced-motion`.

## Abordagens consideradas

1. **Lista recursiva existente ampliada.** Menor dependência, mas não atende pan/zoom, foco e estruturas grandes com boa ergonomia.
2. **`@xyflow/react` com biblioteca adicional de layout.** Resolve navegação e layouts complexos, mas adiciona dependência desnecessária para uma árvore hierárquica.
3. **`@xyflow/react` com projeção e layout próprios.** Escolhida: usa viewport, controles e renderização visível da biblioteca, mantendo a semântica e o layout determinístico em código testável do NEXO.

## Arquitetura

`nexoOrganogram.ts` transforma pessoas/vínculos em um modelo puro de floresta, calcula filhos, ancestrais, visibilidade e coordenadas. O nó virtual de posição não determinada ancora os integrantes sem superior válido e não possui semântica de liderança.

`NexoOrganogram.tsx` adapta esse modelo para nós/arestas do React Flow. O estado local controla busca, seleção, ramificações recolhidas e apresentação em tela cheia. A gestão usa o diálogo existente do dossiê por callback, mantendo confirmação, persistência e auditoria atuais.

`NexoDossier.tsx` apenas registra a nova aba e conecta os dados/callbacks existentes, evitando reconstruir o fluxo de cadastro.

## Tratamento de dados anômalos

- Superior ausente, encerrado ou de outra organização: integrante vai para posição não determinada.
- Ciclo legado inesperado: a projeção interrompe o ciclo e mantém os integrantes visíveis como não determinados.
- Pessoa com mais de um vínculo atual na mesma organização: cada vínculo é um nó, preservando a identidade do registro e evitando perda silenciosa.

## Validação

Testes unitários cobrem construção, membros comuns, raízes não determinadas, ramificações, colapso, busca, ancestrais e dados anômalos. Teste do dossiê garante a nova aba sem regressão das existentes. A entrega termina com lint, testes, TypeScript, build e, se o ambiente local permitir, Playwright com dados sintéticos.
