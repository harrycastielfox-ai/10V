# NEXO — plano de prontidão para uso diário

Este arquivo mantém o plano de trabalho entre sessões. Atualize o estado e as evidências sempre que uma entrega for concluída.

## Critério de pronto

O NEXO pode ser usado diariamente quando uma equipe consegue cadastrar, consultar, editar, vincular, anexar fotografias e emitir relatórios sem perder trabalho, duplicar pessoas por falha de rede ou sobrescrever silenciosamente o trabalho de outro operador. A operação também precisa ter recuperação testada e uma forma objetiva de detectar falhas.

## Prioridade 0 — integridade do trabalho

- [x] Tornar a criação e a edição da ficha transacionais no banco.
- [x] Tornar a criação idempotente para que uma resposta perdida não gere uma segunda pessoa.
- [x] Tratar falha de fotografia como pendência recuperável depois que a ficha for salva.
- [x] Detectar edição concorrente usando `updated_at` e oferecer recarga da versão atual.
- [x] Alertar sobre possíveis duplicidades por CPF, RG e combinação de identidade antes de salvar.
- [x] Impedir fechamento acidental de formulário alterado e avisar ao recarregar a página.

## Prioridade 1 — consulta confiável em base crescente

- [ ] Paginar pessoas, organizações e territórios no banco.
- [ ] Carregar álbum e fotografias completas apenas quando o dossiê ou relatório precisar.
- [x] Isolar falha de uma URL de fotografia para que ela não derrube o carregamento do NEXO.
- [ ] Renovar URLs privadas expiradas durante sessões longas.
- [ ] Paginar observações e eventos de hierarquia, removendo o limite fixo de 100 eventos.

## Prioridade 2 — validação operacional

- [x] Adicionar `pnpm run build` ao CI.
- [ ] Automatizar jornadas de navegador: login, cadastro, reabertura, edição, transferência, foto, B.O. e relatório.
- [ ] Testar permissões reais por perfil e duas edições simultâneas.
- [ ] Testar interrupção de rede durante cadastro, upload e desvinculação.
- [ ] Executar piloto supervisionado e registrar tempo, erros e ações repetidas.

## Prioridade 3 — rastreabilidade e recuperação

- [ ] Guardar emissões de relatório com autor, data, recorte, seções, fotografias e versão reproduzível.
- [ ] Tornar a auditoria consultável por ficha e registrar diferenças relevantes antes/depois.
- [ ] Confirmar política de backup do banco, retenção e responsáveis.
- [ ] Criar backup separado das fotografias do Storage.
- [ ] Executar e documentar um teste de restauração do banco e das fotografias.
- [ ] Configurar monitoramento de erros e alertas operacionais.

## Prioridade 4 — rotina de qualidade dos dados

- [ ] Criar fila de revisão por ausência de fonte, informação antiga e vínculo pendente.
- [ ] Atribuir responsável, prazo e resultado para cada revisão.
- [ ] Criar fluxo de mesclagem de pessoas duplicadas preservando histórico e autoria.
- [ ] Mostrar indicadores de completude sem transformar ausência de dado em suspeita.

## Evidências atuais

- CI executa lint, TypeScript, Vitest e o build de produção.
- Suíte local validada com 61 arquivos e 464 testes aprovados.
- Edição de pessoa, endereço e vínculo ocorre em uma única RPC transacional.
- Conflitos de versão interrompem a gravação antes de qualquer alteração e oferecem recarga explícita.
- RLS da tabela compartilhada de endereços permite ao NEXO somente registros criados pelo operador ou vinculados a fichas acessíveis.
- Falha no upload não desfaz nem repete a ficha: o operador recebe aviso de fotografia pendente e pode reenviar depois.
- Perfil e fotografia de relatório apontam para o mesmo objeto em uma única atualização; a substituição tenta limpar objetos anteriores pertencentes ao operador.
- Auditoria de criação, atualização e exclusão do NEXO existe no banco.
- Hierarquia mantém eventos próprios.
- Vínculos de procedimentos já usam paginação e retentativa de leitura.
- Relatórios já permitem escolher seções e fotografias, mas a emissão ainda não é arquivada.
