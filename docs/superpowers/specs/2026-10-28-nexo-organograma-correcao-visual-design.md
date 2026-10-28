# NEXO Organograma — correção visual

## Intenção

Corrigir a primeira apresentação do organograma, que ficou horizontal, pequena e confundiu o agrupamento de posição não determinada com um superior fictício.

## Direção aprovada

- Exibir a hierarquia de cima para baixo, com subordinados distribuídos horizontalmente por ramificação.
- Remover o nó virtual conectado “Posição não determinada”. Raízes permanecem sem aresta de entrada e recebem identificação textual de que não há superior cadastrado.
- Aumentar cartões e legibilidade sem prejudicar zoom, pan, busca, colapso e tela cheia.
- Usar no preview oito personagens fictícios por organização, derivados do fixture estruturado existente, para demonstrar níveis e ramificações.
- Manter todas as identidades, fontes e retratos estritamente sintéticos.

## Não objetivos

- Não alterar o schema, RLS ou persistência.
- Não usar dados investigativos reais.
- Não implementar edição estrutural nesta correção.
- Não publicar no Cloudflare.

## Abordagem

Foi escolhida a evolução do modelo e do componente atuais. Alternativas de criar outro canvas ou desenhar posições manualmente foram descartadas por duplicarem infraestrutura e reduzirem a manutenção.

## Aceite

- Nenhum bloco artificial aparece como superior dos nós raiz.
- Profundidade aumenta no eixo vertical e irmãos ocupam posições horizontais distintas.
- O cenário BDM demonstra pelo menos três níveis, uma bifurcação e oito integrantes fictícios.
- Testes, build, Playwright e CI permanecem verdes antes do merge do PR na `main`.
