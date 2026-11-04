# Marcação territorial no mapa de ruas

O mapa territorial utiliza Leaflet (dependência existente) e a mesma base OSM France dos mapas de procedimentos. Em Adicionar local, Contornar área registra vértices; Circular área usa dois cliques (centro e borda), com raio mínimo de 5 m. O círculo é representado por 48 vértices geográficos. Desenhar não salva: a confirmação do formulário permanece obrigatória.

## Compatibilidade

O campo JSON `pontos` existente é mantido. Novos pontos têm `{x: longitude, y: latitude, coordinateSystem: "wgs84"}`. Pontos sem esse identificador continuam sendo percentuais da imagem antiga e são exibidos exclusivamente nela, pela opção Ver marcações antigas. Não se deve converter esses percentuais automaticamente: a imagem antiga não tem georreferenciamento comprovado. Nenhuma migration ou conversão de dados foi executada.

A leitura e escrita existentes no repositório preservam o JSON. O cadastro, os controles de acesso e a auditoria do banco não foram alterados. Compatibilidade com o banco remoto não foi testada nesta entrega; a conferência usou o schema versionado e dados sintéticos locais.

## Validação local

- Testes de coordenadas: distinção entre legado/WGS84, rejeição de coordenadas inválidas e raio geodésico após serialização JSON.
- Testes existentes de sobreposição.
- Conferência Playwright com dados fictícios: carregamento das ruas, abertura de Adicionar local, criação de círculo, 48 pontos, polígono visível e limpeza. Sem gravação remota.

O mapa depende de conexão com o provedor de mapas. Os nomes e vínculos são renderizados localmente, não enviados ao provedor de tiles. O provedor recebe as solicitações das áreas geográficas visualizadas. O mapa inicia em Itabela e permite navegação; desenhar em outra cidade não preenche automaticamente o endereço do formulário. A marcação é uma informação registrada pelo usuário, não um limite territorial oficial.
