# NEXO Code Splitting Design

## Intent

Reduzir o custo da primeira abertura do NEXO sem alterar dados, permissões ou fluxos existentes.

## Chosen approach

- Manter a Central e sua navegação no chunk inicial.
- Carregar sob demanda painéis secundários, dossiê, criação, pesquisa e relatórios com `React.lazy`.
- Exibir fallback institucional curto enquanto um módulo é baixado.
- Não montar a paleta de pesquisa enquanto estiver fechada.
- Reduzir o orçamento automatizado do chunk inicial de 850 KB para 450 KB.

## Alternatives considered

- Configurar `manualChunks` globalmente: pode separar bibliotecas, mas é mais frágil e não acompanha a intenção das telas.
- Reescrever `NexoWorkspacePage`: risco alto e fora do escopo de desempenho solicitado.

## Constraints

Sem novas dependências, migrations, alterações de autenticação ou mudanças em dados. A Central deve continuar disponível imediatamente e todos os módulos secundários devem preservar seus props e ações.
