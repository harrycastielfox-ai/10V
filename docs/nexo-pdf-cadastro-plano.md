# NEXO — cadastro por PDF e relatório revisado

Plano baseado nos três PDFs fornecidos pelo usuário em 21/10/2026. Eles contêm dados reais: não entram no repositório, nos testes, na demonstração nem em logs. O objetivo é aproveitar a estrutura dos documentos, não copiar seu conteúdo.

## Entrega inicial neste checkout

- Ao cadastrar uma pessoa, escolher **Manual** ou **Anexo PDF**. Edição de cadastro existente continua manual.
- PDF textual é lido **no navegador**, com limite de 15 MB e 30 páginas. O original não é enviado ou armazenado.
- Os candidatos mostram valor, fonte e página. Valores contraditórios e campos suspeitos exigem escolha; só os selecionados seguem para o formulário normal, onde ainda podem ser corrigidos.
- Imagens incorporadas também são detectadas em memória: o operador vê a miniatura e escolhe se ela será foto de perfil, foto do relatório ou não será importada. Imagens rasterizadas de página inteira são ignoradas para evitar confundir documento escaneado com retrato.
- A finalidade escolhida é mantida até o salvamento: foto de perfil e foto exclusiva do relatório são gravadas nas colunas correspondentes; quando a mesma imagem é usada nas duas finalidades, um único arquivo é referenciado.
- Páginas reconhecidas como SIGIP (ocorrência) e RENAVAM (veículo) não são tratadas como qualificação da pessoa. PDF somente em imagem informa a necessidade de OCR.
- A fonte resumida e as observações registram nome do arquivo, campos escolhidos e páginas. Isso **não substitui** o armazenamento do documento original nem prova autenticidade dos valores.

## Correspondência com o cadastro atual

| Informação dos modelos | Situação no NEXO | Decisão |
| --- | --- | --- |
| Nome, CPF, RG, nascimento, filiação, sexo, naturalidade, estado civil, profissão, escolaridade, altura, contato e endereço | Campos da pessoa já existem | Sugerir com fonte/página; conferir antes de gravar |
| CNH e Renach | `documentos_extras` comporta números e tipos | Sugerir como documentos extras; não inferir situação da habilitação |
| Retrato/foto da pessoa no PDF | O cadastro aceita foto de perfil e de relatório; a prévia extrai recortes de imagens incorporadas e preserva a finalidade escolhida no salvamento | Persistir o documento-fonte e sua auditoria; ampliar detecção para PDFs escaneados/OCR |
| Ocorrência, unidade, data, classificação e papel da pessoa | Vínculos com procedimentos têm estrutura distinta da qualificação | Não misturar na pessoa; modelar vínculo com papel, fonte e data após revisão |
| Veículo, placa, chassi, RENAVAM e proprietário | Cadastro/vínculo de veículo é separado | Não importar como atributos da pessoa; localizar veículo existente antes de criar outro |
| Restrições, resultados de consultas e histórico de habilitação/veículo | Sem representação granular com data e fonte para todos os estados | Criar fatos consultados, com estado `não informado`/`não consta` distinto de `sem restrição` |
| Documento original e trecho que sustenta cada campo | Ainda não persistidos | Tabela de documento-fonte e alegações revisadas, com hash e referência de página |

## Próxima arquitetura de importação

1. **Documento-fonte privado:** upload autenticado, validação de MIME/assinatura, tamanho e páginas, hash SHA-256, caminho privado, autor, data, versão do extrator e política de retenção. Preservar original; nunca reescrever o PDF recebido. RLS e auditoria de acesso/exclusão.
2. **Extração por página:** camada textual; OCR apenas para páginas sem texto. Guardar texto/candidatos temporariamente, com coordenadas e trecho de origem. Não usar o nome do arquivo como única prova de procedência. PDF de várias pessoas deve pedir a seleção explícita de quem será cadastrado.
3. **Foto extraída do PDF:** localizar imagens incorporadas e, se necessário, recortes renderizados da página; registrar página e posição. Separar retrato da pessoa de brasões, assinaturas, documentos, veículos e fotos de terceiros. Apresentar miniaturas e recorte ao lado do documento; o operador escolhe explicitamente se usa como foto de perfil, foto de relatório ou não importa. Não substituir foto existente automaticamente. Preservar proporção/qualidade, origem e original; não tentar identificar a pessoa por reconhecimento facial.
4. **Normalização sem inferência:** `valor_original`, `valor_normalizado`, fonte, página, confiança de leitura e estado (`sugerido`, `aceito`, `rejeitado`, `corrigido`). Contradições ficam lado a lado. Separar pessoa, veículo, procedimento e fatos de consulta; ausência de valor não vira resposta negativa.
5. **Revisão humana obrigatória:** prévia do PDF ao lado dos campos e das fotos; aceitar/rejeitar/corrigir individualmente, detectar possíveis duplicatas, impedir que salve uma ficha com origem ambígua sem decisão. Mudanças ficam auditáveis. Só então persistir pessoa e entidades relacionadas em transação/idempotência.
6. **Segurança operacional:** não usar PDFs reais em testes automatizados, prévias públicas ou serviços externos de OCR sem autorização específica. Não registrar conteúdo extraído em telemetria/console. Limitar memória/tempo de processamento e rejeitar arquivos inválidos.

## Novo relatório em duas partes

**Parte I — ficha e análise.** Capa compacta, identificação, dados qualificados, fontes/documentos, vínculos e seus níveis de confirmação, procedimentos, veículos relacionados, localização, observações escolhidas e ressalvas. Distinguir o que consta no cadastro, o que veio de documento e o que é avaliação analítica. Exibir `não informado` quando faltar dado, sem preenchimento inventado.

**Parte II — anexo fotográfico/documental.** Fotos selecionadas por pessoa/categoria, legenda, origem e numeração estável; documento-fonte listado com hash e referência, quando a persistência estiver implementada. Iniciar em página própria. Nunca separar imagem e legenda nem deixar cabeçalho isolado no fim da página.

O layout deve ser mais legível que os formulários antigos, mas preservar campos operacionais úteis. Gerar A4 com margens institucionais, cabeçalho/rodapé discretos e paginação controlada pela aplicação; evitar cabeçalhos e URLs automáticos do navegador no PDF final.

## Critérios de aceite antes de publicar

- Testar PDF textual de 2, 3 e 5 páginas, sem usar nomes reais nos snapshots; PDFs de imagem, protegidos, vazios, grandes e corrompidos devem dar erro compreensível.
- Testar mesmo campo em duas fontes concordantes e divergentes, multipessoas, CPF/nascimento inválidos, campos colados e SIGIP/RENAVAM sem atribuição indevida.
- Testar PDF com um retrato, vários retratos, imagem pequena/baixa qualidade, brasão e fotos de terceiros; nenhuma imagem deve entrar na ficha sem seleção e conferência da página de origem.
- Renderizar e conferir visualmente **todas as páginas** de relatórios curtos, longos, com fotos e sem fotos; verificar conteúdo e ausência de cortes, cabeçalhos soltos, páginas vazias e legenda separada da foto.
- Conferir RLS, upload privado, trilha de auditoria, duplicidade/idempotência e recuperação de falhas antes de ativar persistência de documentos reais.
- Publicação em `main` somente após testes, revisão visual e escopo de dados sensíveis confirmado. A prévia local não equivale a implantação em produção.
