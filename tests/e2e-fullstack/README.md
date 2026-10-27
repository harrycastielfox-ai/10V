# E2E full-stack isolado

Esta suíte é separada dos smoke tests. Ela não intercepta respostas do Supabase e não injeta
sessões artificiais. O runner cria um projeto Supabase local novo e descartável dentro de
`.git/codex-recovery-e2e`, aplica o candidato de baseline recuperado, cria somente usuários
`example.test`, executa Chromium com um gateway preso a `127.0.0.1` e para apenas o projeto que
acabou de criar.

Execute somente com Docker Desktop iniciado:

```powershell
pnpm run test:e2e:fullstack
```

Guardas importantes:

- a CLI Supabase está fixada na versão do lockfile;
- nenhum vínculo remoto, `.env` do projeto ou token de acesso Supabase é copiado;
- `db reset` usa `--local` em um workspace recém-criado;
- o encerramento usa o `project_id` único, sem `--all` e sem `--no-backup`;
- a service-role é usada somente pelo seed Node e não entra no processo Playwright/Vite;
- navegador e Vite usam o mesmo origin; o proxy do Vite encaminha apenas `auth`, `functions`,
  `rest` e `storage` para a origem Supabase HTTP exata já validada em `127.0.0.1`;
- os artefatos são locais e contêm apenas dados sintéticos.

O conjunto atual valida conectividade, login/logout, bloqueio de perfil, autorização administrativa,
negação HTTP/PostgREST de escrita direta nas tabelas transacionais de Vistorias e um fluxo funcional
completo de Vistorias. O cenário cria veículo e vistoria pela interface, grava uma segunda versão,
recarrega o registro, envia PDF sintético ao Storage privado e recupera o arquivo por URL assinada.
Outro cenário cria um veículo com imagem PNG sintética, valida a conversão em original/miniatura
WebP, os dois uploads privados e a recuperação assinada da miniatura na tela de detalhes.
Um cenário separado cria outro veículo, abre o editor a partir dos detalhes, salva a alteração e
comprova a persistência após recarregar a página.
O cenário de Objetos cria um registro com imagem sintética, valida os dois WebP privados e a
recuperação assinada, edita o registro pela rota não aninhada e comprova a persistência dos novos
valores e da fotografia após recarregar a página.
O cenário de Representações cria um `Relatorio Final` sem procedimento vinculado, confirma na
resposta real da Data API que o tipo normalizado aceito é `outros`, abre o detalhe, edita o processo
judicial e comprova a persistência após recarregar a página. Ele também registra como falha qualquer
resposta não bem-sucedida das APIs locais durante o fluxo.
O cenário de Inquéritos percorre o cadastro de seis etapas com uma classificação e uma pessoa
inteiramente sintéticas, verifica as respostas reais da tabela e da RPC `replace_inquerito_pessoas`,
abre o detalhe, edita a mesma pessoa e comprova a persistência após recarregar a página.
O cenário de Boletins cria um inquérito sintético de apoio, cadastra e vincula um B.O. pela interface,
edita e recarrega o registro e, por fim, confirma que a duplicidade case-insensitive recebe HTTP 409/
`23505` e é explicada ao usuário sem criar uma segunda linha.
O cenário funcional do NEXO percorre as seis etapas do cadastro manual, cria e edita uma pessoa
inteiramente sintética pelas RPCs transacionais, confirma a prévia protegida antes do dossiê sigiloso
e comprova a persistência após recarregar a página. A mesma execução envia uma imagem PNG sintética
ao bucket privado `nexo-private` e recupera a fotografia por URL assinada antes e depois da recarga.
Ela também importa um PDF sintético como documento-fonte, preserva metadados e hash, anexa um segundo
PDF como recurso privado, atualiza sua observação e recupera a prévia assinada após nova recarga.
Por fim, abre o configurador de relatório, confirma que os dois PDFs podem ser selecionados, valida
a composição da prévia individual e comprova uma chamada a `window.print` com o diálogo nativo
substituído por um contador seguro. Isso valida a preparação para impressão/salvamento pelo navegador,
mas não afirma que um arquivo PDF final tenha sido salvo no disco. O mesmo fluxo baixa o pacote
documental ZIP, verifica seu manifesto, a fotografia e os dois PDFs reais e confirma que o índice
portátil não contém URLs assinadas, tokens nem caminhos privados do Storage.
Um cenário de autorização separado confirma que um membro autorizado, mas sem papel NEXO, é
redirecionado ao seletor de módulos.
Se o Docker não
estiver instalado ou o daemon estiver inativo, o runner encerra antes de criar o workspace e informa
a dependência ausente. Um teste listado só deve ser registrado como aprovado depois da execução
completa do comando acima.
