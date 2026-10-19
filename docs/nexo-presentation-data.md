# Conjunto sintético de apresentação — NEXO

Preparado em 18/10/2026 para apresentação funcional. A fonte reproduzível é
`src/features/nexo/nexoPresentationData.ts`; não modifica os antigos fixtures de testes.

## Conteúdo

- Cinco facções inventadas: Aliança do Horizonte, Núcleo Prisma, Círculo Ônix,
  Frente Boreal e Rede Vértice. Todas levam `(Fictícia)` no nome e cores distintas.
- Dez personagens por facção: um líder, um vice-líder, dois coordenadores e seis
  integrantes. A hierarquia utiliza IDs de vínculos, sem ciclos ou superiores de
  outra organização.
- Cinquenta nomes compostos inventados, todos com sufixo `· DEMO`; CPF e telefone
  vazios. Os identificadores `DEMO-001` etc. não são documentos civis. Os e-mails
  usam o domínio reservado `.invalid` e não são contatos reais.
- Cinquenta retratos sintéticos locais, em
  `/nexo-demo/portraits/person-01.png` a `person-50.png`. As legendas explicitam que
  são personagens fictícios. O namespace reservado de imagem é
  `demo-public/person-XX.png`, não uma URL externa ou imagem de pessoa real.
- Cinco setores cenográficos, cinquenta notas individuais, cinco notas de facção
  e cinquenta eventos de entrada na hierarquia.
- Dez B.O.s `DEMO-BO-xxxx/2026` e cinco inquéritos `DEMO-IP-xxxx/2026`. Os cinco
  inquéritos referenciam os cinco primeiros B.O.s: são dez fatos sintéticos,
  não quinze crimes. Seis exemplos ilustram CVLI e quatro outras naturezas.
  Trinta vínculos permitem abrir os mesmos procedimentos pela facção ou pessoa.

## Geografia: o que é real e o que não é

Itabela/BA é o cenário cartográfico, código IBGE `2914653`.
O mapa público da [Prefeitura de Itabela — Como Chegar](https://www.itabela.ba.gov.br/localizacao)
usa a âncora municipal latitude `-16.575`, longitude `-39.552777777778`.
A identificação do município pode ser conferida no
[IBGE — Itabela](https://www.ibge.gov.br/cidades-e-estados/ba/itabela.html).

Os setores A–E, os polígonos e seus deslocamentos em relação a essa âncora são
**inteiramente hipotéticos**. Não foram pesquisadas residências, não são limites
oficiais de bairros e não indicam domínio criminal, sede de facção ou local de
ocorrência real. Os campos de endereço e observações deixam isso explícito;
nenhum imóvel tem número cadastrado. Não usar o conjunto como inteligência
operacional, para diligências, estatísticas reais ou identificação de pessoas.

Cada link usa o padrão público
`https://www.google.com/maps/search/?api=1&query=latitude%2Clongitude`, conforme a
[documentação oficial de URLs do Google Maps](https://developers.google.com/maps/documentation/urls/get-started).
Os links demonstram abertura e navegação geográfica; não alegam que os
personagens fictícios residem nesses pontos.

## Integração e limpeza

Todos os IDs são UUIDs estáveis sob o prefixo `f0e`. O conjunto não acessa o
Supabase e não apaga nem insere registros por conta própria. Sua integração e
eventual carga persistente devem ser executadas pelo fluxo autorizado de
preparação da apresentação.

`NEXO_PRESENTATION_AUTHOR_ID` é um UUID sentinela, não um usuário real. Antes de
persistir observações ou registros que exijam autoria, substituir pelo UUID de
um usuário administrador preservado. Não criar contas com esse UUID.

`procedures` contém descritores tipados de carga, não DTOs completos das tabelas
de B.O.s/inquéritos. A integração deve mapear os campos da tabela existente,
respeitar os IDs relacionados e preencher o contexto `data_fato`, `hora_fato`,
`bairro`, `latitude`, `longitude` com os valores explícitos dos descritores.
Não usar `created_at` como data do fato. Os pares B.O./inquérito preservam
`relatedBoNumber` e `incidentKey` para deduplicação.

Os testes verificam contagens, unicidade de fotos/UUIDs, hierarquia sem ciclos,
links de mapa, marcação fictícia e integridade dos vínculos. A existência física
e revisão dos cinquenta retratos cabe à etapa de geração dos arquivos.
