# Identidade do SIED

## Nome institucional

**SIED — Sistema Integrado de Evidências e Dados** é a identidade apresentada a
usuários, em telas de acesso, módulos, relatórios, documentos impressos e
metadados do sistema.

O nome representa a convergência dos módulos operacionais, de procedimentos,
vistoria de veículos, objetos, agenda, auditoria e demais dados institucionais
sob uma única experiência web.

## Marca visual

A marca oficial está em [`public/sied-mark.svg`](../public/sied-mark.svg).
Ela usa um escudo técnico, conexões de dados e um núcleo de evidência, com as
cores azul-profundo, ciano e verde institucional. Por ser vetorial, mantém
qualidade em navegação, favicon e documentos impressos.

## Compatibilidade técnica

Esta transição é de identidade pública. Os identificadores internos que já
compõem contratos de dados e integração permanecem estáveis, incluindo:

- o repositório e o projeto Supabase `sipi-delegacia-10v`;
- valores de papéis e permissões, como `sipi_access`;
- chaves de armazenamento local e cabeçalhos de sincronização já publicados;
- nomes de componentes e classes CSS legados quando não alteram a interface.

Essa separação evita perda de sessão, quebra de migrations, incompatibilidade
com integrações existentes e alterações desnecessárias em dados históricos.
