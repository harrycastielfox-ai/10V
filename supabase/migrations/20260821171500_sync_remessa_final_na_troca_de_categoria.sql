-- O gatilho da remessa final só disparava quando a remessa mudava. Procedimento
-- já remetido que depois era corrigido para CVLI ficava com cvli_elucidado,
-- elucidado e data_elucidacao desatualizados, e só um desmarca-e-remarca da
-- remessa punha tudo no lugar.
--
-- Agora a categoria também dispara o gatilho, e o caminho inverso — deixar de
-- ser CVLI — limpa o cvli_elucidado, que não faz sentido fora do CVLI.

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
  elsif tg_op = 'UPDATE'
    and upper(trim(coalesce(old.categoria_criminal, ''))) = 'CVLI' then
    -- Saiu do CVLI: o campo é exclusivo dessa categoria e passa a não valer.
    -- elucidado e data_elucidacao ficam como estão, porque servem a qualquer
    -- procedimento e apagá-los perderia informação.
    new.cvli_elucidado := null;
  end if;

  return new;
end;
$$;

revoke execute on function public.sync_inquerito_remessa_final() from public, anon, authenticated;

drop trigger if exists sync_inquerito_remessa_final_trigger on public.inqueritos;

create trigger sync_inquerito_remessa_final_trigger
before insert or update of remessa_final_status, data_remessa_final, categoria_criminal
on public.inqueritos
for each row
execute function public.sync_inquerito_remessa_final();
