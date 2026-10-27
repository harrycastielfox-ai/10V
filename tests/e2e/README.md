# Chromium isolado

Execute `pnpm run test:e2e:install` uma vez e `pnpm run test:e2e` para rodar a
suíte. A configuração inicia o Vite em loopback com URL/chave Supabase locais
inertes. Um servidor já aberto na mesma porta não é reutilizado, pois poderia
ter sido iniciado com a configuração produtiva de `.env.local`.

`E2E_BASE_URL` só aceita aplicação em loopback. A fixture compartilhada bloqueia
requisições de Auth, REST, Storage e Edge Functions que não tenham a origem
`http://127.0.0.1:54321`; qualquer tentativa externa também reprova o teste.
O teste de bloqueio usa domínio reservado `.test`, sem serviço real.

Os smoke tests cobrem login renderizado, navegação sem sessão, indisponibilidade
de autenticação e leitura local de um PDF sintético no NEXO. O arquivo
`auth-guards.e2e.ts` acrescenta recuperação de falha HTTP 500 do perfil e
expiração com refresh pendente. Ele injeta uma sessão sintética não assinada
para exercitar o SDK, os efeitos React, o timeout e os redirecionamentos no
navegador. As respostas da API são interceptadas.

Esses cenários não demonstram login/logout reais, autorização do servidor,
persistência no Supabase, upload/recuperação no serviço Storage ou CRUD real.
Uma suíte full-stack deverá usar outra configuração e um Supabase isolado
com dados sintéticos; a proteção desta suíte smoke não deve ser removida para
fazê-la acessar produção.

Chromium desktop e Pixel 7 são executados. Os dois cenários do workspace NEXO
são skips explícitos no mobile, de acordo com a política atual da aplicação.
