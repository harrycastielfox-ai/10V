# NEXO Organograma — núcleos e setores persistidos

## Intenção

Entregar a primeira parte da fase 3 do Organograma 2.0 sem criar cadastros paralelos de pessoas ou organizações. Núcleos e setores serão agrupamentos internos explícitos de uma organização, criados e mantidos por usuário autorizado. Nenhum agrupamento será inferido automaticamente a partir de cargo, cidade, procedimento ou posição na árvore.

## Modelo de dados

- Criar `public.nexo_nucleos` com organização, nome, descrição opcional, cor, ordem de apresentação, autoria, datas e exclusão lógica.
- Adicionar `nucleo_id` opcional a `public.nexo_vinculos`, porque a participação pertence ao vínculo da pessoa com aquela organização.
- Garantir no banco que o núcleo selecionado esteja ativo e pertença à mesma organização do vínculo.
- Ao encerrar ou transferir um vínculo, remover sua associação ao núcleo anterior.
- Ao excluir logicamente um núcleo, desassociar seus vínculos na mesma operação controlada.
- Indexar todas as chaves estrangeiras e os acessos por organização/ordem.

## Segurança e auditoria

- Manter RLS e o mesmo gate institucional já aplicado aos registros do NEXO; não conceder acesso a `anon`.
- Usar privilégios mínimos: leitura, criação e atualização para `authenticated`, sem `DELETE` físico pela Data API.
- Reutilizar a auditoria geral do NEXO para criação, alteração e exclusão lógica de núcleos.
- Ampliar `nexo_hierarquia_eventos` para registrar núcleo anterior e novo somente quando houver mudança efetiva.
- Usar `security invoker` nas operações comuns. O arquivamento atômico usa uma RPC `security definer` mínima, com verificação explícita de `auth.uid()`, acesso NEXO, `search_path` vazio e execução negada a papéis não autorizados.

## Experiência de uso

- A aba Organograma terá uma ação “Núcleos e setores” para criar, renomear, ordenar e arquivar agrupamentos.
- O gerenciamento de vínculo permitirá selecionar um núcleo da organização escolhida.
- Os cartões e o painel lateral mostrarão o núcleo quando informado.
- A árvore continuará hierárquica por chefia. O núcleo funcionará como contexto visual e filtro, sem substituir `superior_vinculo_id`.
- Integrantes sem núcleo permanecerão visíveis e serão apresentados como “Sem núcleo definido”, sem classificação automática.
- Alterações só serão persistidas após envio explícito do formulário; arrastar cartões continuará sem efeito estrutural.

## Tratamento de falhas

- O formulário permanecerá aberto quando a gravação falhar e exibirá erro recuperável.
- O estado local só será atualizado após confirmação do banco.
- Núcleo inexistente, arquivado ou de outra organização será rejeitado no banco, mesmo que o frontend seja contornado.
- O fluxo de transferência limpará núcleos incompatíveis, evitando referência silenciosa à organização anterior.

## Entrega incremental

1. Schema, RLS, validação cruzada e auditoria.
2. Tipos, repositório e carregamento dos núcleos.
3. Gestão de núcleos e associação no formulário de vínculo.
4. Identificação visual, filtro no organograma e regressões de interface.

Rede de relações não hierárquicas e exportação PDF continuam fora desta branch.
