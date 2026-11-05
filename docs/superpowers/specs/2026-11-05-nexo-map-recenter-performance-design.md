# NEXO Map Recenter Performance Design

## Intent

Reduzir a sensação de travamento periódico na Central NEXO sem retirar a recentralização automática de 10 segundos aprovada pelo usuário.

## Chosen approach

- Manter o intervalo automático de 10 segundos.
- Usar reposicionamento instantâneo, sem `flyTo`, apenas nos ciclos automáticos.
- Remover o contador visual de ciclos automáticos para não provocar um rerender React a cada intervalo.
- Preservar a animação discreta do botão manual e o respeito a `prefers-reduced-motion`.

## Alternatives considered

- Aumentar ou desativar o intervalo: reduziria mais trabalho, mas contraria o comportamento aprovado.
- Pausar durante interação: melhoraria a manipulação do mapa, mas também contraria a regra aprovada de recentralizar mesmo durante uso.

## Constraints

Sem novas dependências, migrations, alterações de autenticação ou mudanças em dados. O comportamento será coberto por teste unitário e validado no preview local.
