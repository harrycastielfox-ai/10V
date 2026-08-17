# Sistema de Boletins de Ocorrência

Planilha oficial: `[DT] BOLETIM DE OCORRÊNCIA`

ID da planilha: `1prgEuUOxyW7qdILyFbemvUlgetAgtbQDXOL7sbHQEWk`

## Arquivos do Apps Script

- `Boletins.gs`: menus, cadastro, edição, exclusão, pesquisa, segurança e auditoria.
- `BoApp.html`: janelas de cadastro/pesquisa, lista de resultados, ficha individual e impressão.

## Menus criados

Ao abrir a planilha, o script adiciona dois menus separados:

- **Cadastrar**
  - Cadastrar B.O
  - Editar B.O
  - Excluir B.O
- **Pesquisar**
  - Buscar B.O

## Estrutura esperada

A base utilizada é a aba `B.O'S EM ANDAMENTO`, com as colunas:

1. Nº B.O.
2. Infração penal
3. Diligências pendentes
4. Responsável pelo procedimento
5. Observação
6. Status

O campo **Status** usa as opções: `Pendente`, `Em Andamento`, `Agendada`,
`Aguardando Terceiros`, `Concluída`, `Cancelada`, `Suspensa` e
`Aguardando Aprovação/Revisão`. Novos B.O.s começam como `Pendente`.

## Regras da primeira versão

- Nº do B.O. e infração penal são obrigatórios.
- O status pode ser selecionado no cadastro, na edição e na pesquisa.
- O número do B.O. não pode ser repetido.
- A pesquisa aceita trechos de qualquer campo e combina os filtros preenchidos.
- A ficha individual pode ser impressa pelo próprio painel.
- Exclusões ficam registradas na aba oculta `_BO_AUDITORIA` antes da linha ser removida.
- Edições verificam se o registro mudou desde que foi aberto, evitando sobrescrever alterações de outra pessoa.
- O código se recusa a operar se for instalado em outra planilha por engano.

## Instalação

A instalação será feita em conjunto posteriormente. Não é necessário copiar estes arquivos para a planilha sem acompanhamento.
