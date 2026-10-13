# Decisão arquitetural: sistema web interno

**Estado:** aprovado em 13/10/2026.

## Decisão

O SIPI/10V será desenvolvido e distribuído como sistema web interno. A aplicação deve
ser acessada por navegador corporativo, com autenticação, autorização e persistência
centralizadas no Supabase e publicação controlada na infraestrutura Cloudflare.

## Motivos operacionais

- Computadores institucionais podem restringir instaladores, executáveis, certificados e
  permissões administrativas.
- Uma única publicação atualiza todos os usuários autorizados sem reinstalação local.
- Auditoria, RLS, documentos e dados operacionais permanecem sob controle central.
- O modelo reduz divergência de versões entre estações e facilita suporte técnico.

## Diretrizes

- O sistema não deve depender de aplicativo Windows para os módulos SIPI: procedimentos,
  B.O., veículos, objetos, agenda, vistorias, relatórios e auditoria.
- A interface deve continuar com experiência de produto: login, módulos, rotas diretas,
  design responsivo e atalhos de uso frequente.
- PWA é uma evolução opcional. Ela poderá criar atalho e janela própria quando a TI
  autorizar, mas usará a mesma aplicação web e o mesmo backend.
- Uma integração nativa só será considerada no futuro quando houver necessidade objetiva
  de hardware local ou ferramenta especializada que não possa ser atendida pelo navegador.

## Limites de segurança

- Nenhuma informação operacional deve ser persistida em cache local como substituto do
  banco autorizado.
- Dados, permissões e eventos de auditoria continuam sujeitos às policies/RPCs do banco.
- A decisão não autoriza integrar ou automatizar sistemas externos sem escopo e autorização
  explícitos.
