# SIED — Visão de Produto

## Origem

O SIED nasceu da evolução dos controles operacionais utilizados na planilha DRT. A planilha foi a principal referência histórica para entender como a unidade acompanhava procedimentos, prazos, prioridades, representações e indicadores criminais antes da consolidação em sistema.

A planilha DRT não deve ser copiada como interface ou arquitetura. Ela serviu como fonte de requisitos operacionais: revelou quais informações a equipe realmente consulta, quais controles são críticos para a rotina policial e quais indicadores ajudam a chefia a tomar decisão.

## Objetivo Institucional

O objetivo institucional do SIED é transformar o acompanhamento de dados operacionais da unidade em um sistema centralizado, seguro, auditável e orientado a dados reais.

O sistema deve centralizar o acompanhamento de:

- Inquéritos
- Representações
- CVLI
- Medidas Protetivas
- Réu Preso
- Equipes
- Produtividade

Essa centralização busca reduzir controles paralelos, melhorar a rastreabilidade das decisões e dar à chefia uma visão confiável do trabalho em andamento.

## Princípios

- Dados reais acima de dashboards bonitos.
- Segurança acima de conveniência.
- RLS obrigatória para dados sensíveis.
- Auditoria obrigatória para operações críticas.
- Nenhum indicador inventado.
- Nenhuma produtividade artificial.

## Módulos Estratégicos

### Inquéritos

O módulo de Inquéritos deve ser a base operacional do SIED. Ele concentra os procedimentos, dados de identificação, datas relevantes, prazos, tipificação, gravidade, prioridade, status, responsáveis e informações complementares necessárias ao acompanhamento da unidade.

### Representações

O módulo de Representações deve registrar medidas judiciais vinculadas a procedimentos, como prisões, buscas, quebras de sigilo, medidas protetivas e outras solicitações. Deve preservar vínculo com PPE, status judicial, cumprimento, prazos e sigilo quando aplicável.

### Auditoria

A Auditoria deve registrar operações críticas realizadas no sistema. Ela é essencial para rastreabilidade, responsabilização e segurança institucional, especialmente em alterações de procedimentos, representações, usuários, permissões e dados sensíveis.

### Administração de Usuários

A Administração de Usuários deve permitir controle institucional de acesso, status, cargos e perfis. Deve priorizar segurança, autorização explícita e clareza operacional sobre quem pode acessar ou alterar informações sensíveis.

### Dashboard Operacional Forte

O Dashboard Operacional Forte deve ser uma central de leitura rápida da unidade, com indicadores baseados apenas em dados existentes e regras verificáveis. Ele não deve criar métricas artificiais nem ranking sem contrato confiável.

## Dashboard Operacional Forte

Os pilares estratégicos do Dashboard Operacional Forte são:

- Procedimentos por Tipo
- Análise por Gravidade
- Carga por Dia da Semana
- Produtividade Operacional
- CVLI
- Indicadores Judiciais
- Indicadores de Equipe
- Alertas Inteligentes

Cada indicador deve respeitar permissões, RLS e os dados efetivamente acessíveis ao usuário logado. Sempre que uma métrica depender de regra institucional ainda não formalizada, ela deve ser tratada como planejada ou pendente, não como dado definitivo.

## O que veio da planilha DRT

A planilha DRT influenciou diretamente o contrato operacional inicial do SIED, especialmente nos seguintes elementos:

- PPE
- prioridade
- prazo
- dias corridos
- tipificação
- gravidade
- CVLI
- equipe
- escrivão
- representações
- medidas protetivas
- réu preso
- estatísticas anuais
- estatísticas mensais

Esses elementos representam controles reais usados pela unidade e devem ser preservados conceitualmente, adaptados para um sistema moderno, seguro e auditável.

## O que NÃO deve ser copiado da planilha

O SIED não deve reproduzir limitações naturais de uma planilha operacional, como:

- excesso de planilhas paralelas;
- cálculos manuais;
- dependência de Excel;
- indicadores sem rastreabilidade;
- duplicação de informação.

Também não deve importar fórmulas ou classificações sem validar se elas representam uma regra institucional estável. O sistema deve transformar o aprendizado da planilha em fluxo, contrato de dados, segurança e auditoria.

## Visão de Longo Prazo

O SIED deve evoluir como plataforma operacional da unidade policial. Sua função é apoiar o trabalho diário, a supervisão da chefia e a tomada de decisão institucional com dados confiáveis, controles seguros e indicadores explicáveis.

A visão de longo prazo é que o SIED substitua gradualmente controles dispersos, reduza retrabalho, fortaleça a governança dos dados e ofereça uma visão integrada de procedimentos, representações, usuários, auditoria, produtividade e indicadores estratégicos.

O sistema deve crescer com prudência: primeiro consolidando dados reais e segurança; depois refinando experiência, automações, alertas e análises gerenciais.
