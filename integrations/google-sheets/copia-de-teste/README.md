# Apps Script da COPIA DE TESTE

Este modulo foi preparado para a planilha:

`1u7d7v4hwCf_Fzf1yqNKQk3bNzFJnl8856J3gZP0FWPw`

Arquivos do projeto Apps Script:

- `PainelCvli.gs`
- `PainelCvliHtml` (arquivo HTML)
- `CadastroInquerito.gs`

Ao criar o arquivo HTML no editor do Apps Script, digite apenas
`PainelCvliHtml`: o editor acrescenta a extensao sozinho. Digitar
`PainelCvli.html` cria `PainelCvli.html.html`, e `abrirDashboardCVLI` nao
encontra o arquivo.

O `Code.gs` do projeto vinculado deve criar um menu unico chamado
**⚖️ DASHBOARD E CADASTRO**, com **🖥️ DASHBOARD CVLI** no topo e os cadastros
logo abaixo. O `PainelCvli.gs` nao cria mais um menu separado; qualquer
acionador antigo de `criarMenuPainelCvli_` passa a chamar o menu unificado.

`cadastrarInqueritoCopia(dados)` e chamada pelo formulario e espera o objeto
com os campos preenchidos. Executa-la a mao no editor da erro, porque `dados`
chega vazio; para testar o painel, use o menu
**⚖️ DASHBOARD E CADASTRO > 🖥️ DASHBOARD CVLI** na planilha.

O cadastro novo deve chamar `cadastrarInqueritoCopia(dados)`. O campo
`prazoDias` e usado apenas para calcular `DATA LIMITE`; ele nao e gravado na
planilha. As perguntas `vinculadoFaccao` e `medidaProtetiva` tambem ficam apenas
no cadastro. Somente `nomeFaccao` e `numeroProcessoMedida` sao persistidos.

Nao substitua o `Code.gs` da integracao oficial por estes arquivos. O script
oficial usa outro ID e o contrato antigo de 31 colunas.
