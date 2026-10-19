begin;

alter table public.nexo_pessoas
  add column if not exists nome_social text,
  add column if not exists sexo text,
  add column if not exists raca_cor text,
  add column if not exists estado_civil text,
  add column if not exists nacionalidade text not null default 'Brasileira',
  add column if not exists escolaridade text,
  add column if not exists profissao text,
  add column if not exists idade_aproximada boolean not null default false,
  add column if not exists em_situacao_rua boolean not null default false,
  add column if not exists usa_tornozeleira boolean not null default false,
  add column if not exists altura_cm integer check (altura_cm is null or altura_cm between 30 and 260),
  add column if not exists tipo_fisico text,
  add column if not exists estado_aparente text,
  add column if not exists sinais_particulares text,
  add column if not exists documentos_extras jsonb not null default '[]'::jsonb
    check (jsonb_typeof(documentos_extras) = 'array'),
  add column if not exists contatos jsonb not null default '[]'::jsonb
    check (jsonb_typeof(contatos) = 'array');

comment on column public.nexo_pessoas.documentos_extras is
  'Documentos adicionais informados pelo operador; arquivos permanecem no armazenamento privado quando implementados.';
comment on column public.nexo_pessoas.contatos is
  'Telefones, redes sociais e outros contatos declarados no dossiê.';

commit;
