alter table public.inqueritos
  add column if not exists remessa_final_status text,
  add column if not exists data_remessa_final date;

alter table public.inqueritos
  drop constraint if exists inqueritos_remessa_final_status_check;

alter table public.inqueritos
  add constraint inqueritos_remessa_final_status_check
  check (
    remessa_final_status is null
    or remessa_final_status in ('em_andamento', 'remetido')
  ) not valid;

comment on column public.inqueritos.remessa_final_status is
  'Situacao operacional da remessa final: em_andamento ou remetido.';

comment on column public.inqueritos.data_remessa_final is
  'Data em que o procedimento foi marcado como remetido; referencia temporal das elucidacoes no comparativo CVLI.';

-- O backfill altera inqueritos e, por isso, precisa de um ator institucional
-- para o gatilho transacional de auditoria.
select set_config(
  'request.jwt.claim.sub',
  (
    select p.id::text
    from public.profiles as p
    where p.cargo::text = 'admin'
      and p.status_autorizacao::text = 'autorizado'
    order by p.created_at
    limit 1
  ),
  true
);

-- Preserva datas historicas quando o procedimento ja possuia evidencia de envio.
update public.inqueritos
set
  remessa_final_status = 'remetido',
  data_remessa_final = coalesce(
    data_remessa_final,
    data_envio_relatorio::date,
    data_relatorio::date,
    data_elucidacao::date
  )
where
  remessa_final_status is null
  and (
    lower(trim(coalesce(situacao, ''))) = 'remetido'
    or lower(trim(coalesce(relatorio_status, ''))) = 'enviado'
    or lower(trim(coalesce(relatorio_enviado, ''))) in ('true', 't', '1', 'sim', 's', 'yes', 'y', 'ok')
  );

create or replace function public.sync_inquerito_remessa_final()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.remessa_final_status = 'remetido' then
    if tg_op = 'INSERT' then
      new.data_remessa_final := coalesce(
        new.data_remessa_final,
        (statement_timestamp() at time zone 'America/Bahia')::date
      );
    elsif old.remessa_final_status is distinct from 'remetido'
      or new.data_remessa_final is null then
      new.data_remessa_final := coalesce(
        new.data_remessa_final,
        (statement_timestamp() at time zone 'America/Bahia')::date
      );
    end if;
  else
    new.data_remessa_final := null;
  end if;

  if upper(trim(coalesce(new.categoria_criminal, ''))) = 'CVLI' then
    if new.remessa_final_status = 'remetido' then
      new.cvli_elucidado := true;
      new.elucidado := 'Sim';
      new.data_elucidacao := new.data_remessa_final;
    elsif new.remessa_final_status = 'em_andamento' then
      new.cvli_elucidado := false;
      new.elucidado := 'Não';
      new.data_elucidacao := null;
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.sync_inquerito_remessa_final() from public, anon, authenticated;

drop trigger if exists sync_inquerito_remessa_final_trigger on public.inqueritos;

create trigger sync_inquerito_remessa_final_trigger
before insert or update of remessa_final_status, data_remessa_final
on public.inqueritos
for each row
execute function public.sync_inquerito_remessa_final();

create index if not exists inqueritos_remessa_final_date_idx
  on public.inqueritos (data_remessa_final desc)
  where remessa_final_status = 'remetido' and deleted_at is null;

alter table public.inqueritos
  validate constraint inqueritos_remessa_final_status_check;
