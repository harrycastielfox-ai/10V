# Integração da planilha oficial com o SIPI

Este pacote é vinculado exclusivamente à planilha
`[DT] Controle de Procedimentos e Representações`, identificada por
`1YTA8z0kxnQCxCpV9uMzsjIzYJ-MZ_BEks6j_20L3tMU`.

## Garantias do contrato

- A chave técnica `SIPI_SYNC_ID` é criada em coluna oculta e não depende do PPE
  nem do número atual da linha.
- PPE repetido continua sendo aceito.
- Alterar uma linha atualiza o mesmo registro no SIPI.
- Duas verificações consecutivas sem uma chave transformam a remoção da linha
  em exclusão lógica no SIPI.
- Recolocar a mesma linha com sua chave restaura o registro.
- Dados criados diretamente no site continuam coexistindo com os dados da
  planilha.
- O segredo fica em `Script Properties`; nunca é salvo em célula ou no código.
- O bootstrap confere quantidade e hash de todas as chaves antes de escrever na
  planilha ou enviar registros.

## Instalação controlada

1. Abra a planilha oficial e acesse **Extensões > Apps Script**.
2. Substitua o conteúdo de `Code.gs` pelo arquivo desta pasta.
3. Ative a exibição do manifesto e substitua `appsscript.json` pelo manifesto
   desta pasta.
4. Reabra a planilha. No menu **SIPI**, escolha **Configurar conexão**.
5. Informe o endpoint e o segredo compartilhado entregues pelo administrador.
6. Use **Instalar e validar sincronização** uma única vez.

Se qualquer contagem ou hash divergir do levantamento de 10/08/2026, a
instalação para antes de alterar dados policiais. Nesse caso, gere um novo
backup e refaça a conciliação.
