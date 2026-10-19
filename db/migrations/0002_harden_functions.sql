-- Avisos de segurança do Supabase (database linter):
-- 0011 function_search_path_mutable: fixar o search_path da função dos triggers.
alter function public.set_updated_at() set search_path = '';

-- 0028/0029: a função rls_auto_enable() é criada pelo Supabase (opção "ativar RLS automaticamente")
-- e só é usada por um event trigger; não precisa de ser chamável pela API.
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;
