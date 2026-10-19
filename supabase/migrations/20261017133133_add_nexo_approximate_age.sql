alter table public.nexo_pessoas
  add column if not exists idade_aproximada_valor integer
    check (idade_aproximada_valor is null or idade_aproximada_valor between 0 and 130);

comment on column public.nexo_pessoas.idade_aproximada_valor is
  'Idade estimada em anos quando a data de nascimento exata não é conhecida.';
