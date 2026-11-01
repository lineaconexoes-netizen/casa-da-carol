-- =====================================================================
--  Casa da Carol — banco de dados
--  Rode no Supabase: SQL Editor > New query > cole tudo > Run.
--  Pode ser rodado mais de uma vez.
-- =====================================================================

-- Todos os dados do sistema ficam numa tabela só.
-- "colecao" é a aba (habitos, feira, contas, marina...) e "dados" é o conteúdo.
create table if not exists public.itens (
  colecao     text        not null,
  id          text        not null,
  dados       jsonb       not null default '{}'::jsonb,
  dono        uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  atualizado  timestamptz not null default now(),
  primary key (dono, colecao, id)
);
create index if not exists itens_colecao on public.itens (dono, colecao);

-- Cada pessoa só enxerga e altera os próprios dados.
alter table public.itens enable row level security;
drop policy if exists "dono le"      on public.itens;
drop policy if exists "dono grava"   on public.itens;
drop policy if exists "dono altera"  on public.itens;
drop policy if exists "dono apaga"   on public.itens;
create policy "dono le"     on public.itens for select using (dono = auth.uid());
create policy "dono grava"  on public.itens for insert with check (dono = auth.uid());
create policy "dono altera" on public.itens for update using (dono = auth.uid()) with check (dono = auth.uid());
create policy "dono apaga"  on public.itens for delete using (dono = auth.uid());

create or replace function public.itens_touch() returns trigger language plpgsql as $$
begin new.atualizado := now(); return new; end $$;
drop trigger if exists itens_touch on public.itens;
create trigger itens_touch before update on public.itens for each row execute function public.itens_touch();
