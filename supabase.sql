-- Kdo platil? — databáze pro Supabase.
-- Celý soubor vlož do Supabase → SQL Editor → New query a klikni Run. Spustit ho jde opakovaně.
--
-- Bezpečnostní model: tabulky nejsou přes API přímo dostupné (RLS zapnuté, žádné politiky).
-- Appka smí jen volat funkce níže a každá funkce chce kód spisu (20 náhodných znaků).
-- Kdo kód nezná, nic nepřečte ani nezapíše.

create table if not exists public.spisy (
  code       text primary key check (code ~ '^[a-z0-9]{5}(-[a-z0-9]{5}){3}$'),
  people     jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.platby (
  id    bigint generated always as identity primary key,
  code  text not null references public.spisy(code) on delete cascade,
  who   text not null check (who in ('a', 'b')),
  kind  text not null check (kind in ('brunch', 'cake')),
  at    timestamptz not null default now()
);
create index if not exists platby_code_at on public.platby (code, at desc);

alter table public.spisy  enable row level security;
alter table public.platby enable row level security;
revoke all on public.spisy, public.platby from anon, authenticated;

-- Vyčistí jména a rod do pevného tvaru {a:{name,g}, b:{name,g}}.
create or replace function public._spis_lide(p jsonb) returns jsonb
language sql immutable set search_path = public as $$
  select jsonb_build_object(
    'a', jsonb_build_object(
      'name', left(coalesce(nullif(btrim(p #>> '{a,name}'), ''), 'Osoba A'), 20),
      'g', case when p #>> '{a,g}' = 'm' then 'm' else 'f' end),
    'b', jsonb_build_object(
      'name', left(coalesce(nullif(btrim(p #>> '{b,name}'), ''), 'Osoba B'), 20),
      'g', case when p #>> '{b,g}' = 'f' then 'f' else 'm' end)
  );
$$;

create or replace function public.spis_zalozit(p_code text, p_people jsonb) returns void
language sql security definer set search_path = public as $$
  insert into spisy (code, people) values (p_code, _spis_lide(p_people))
  on conflict (code) do nothing;
$$;

-- Vrací {people, log:[{id, who, kind, at(ms)}]} posledních 500 záznamů, nebo null když spis neexistuje.
create or replace function public.spis_nacist(p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'people', s.people,
    'log', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', x.id, 'who', x.who, 'kind', x.kind,
               'at', (extract(epoch from x.at) * 1000)::bigint)
             order by x.at desc)
      from (select * from platby where code = s.code order by at desc limit 500) x
    ), '[]'::jsonb))
  from spisy s
  where s.code = p_code;
$$;

create or replace function public.spis_zapsat(p_code text, p_who text, p_kind text) returns bigint
language plpgsql security definer set search_path = public as $$
declare new_id bigint;
begin
  if not exists (select 1 from spisy where code = p_code) then
    raise exception 'spis neexistuje';
  end if;
  insert into platby (code, who, kind) values (p_code, p_who, p_kind) returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.spis_smazat(p_code text, p_id bigint) returns void
language sql security definer set search_path = public as $$
  delete from platby where code = p_code and id = p_id;
$$;

create or replace function public.spis_jmena(p_code text, p_people jsonb) returns void
language sql security definer set search_path = public as $$
  update spisy set people = _spis_lide(p_people) where code = p_code;
$$;

revoke execute on function public._spis_lide(jsonb) from public, anon, authenticated;
revoke execute on function public.spis_zalozit(text, jsonb)       from public;
revoke execute on function public.spis_nacist(text)               from public;
revoke execute on function public.spis_zapsat(text, text, text)   from public;
revoke execute on function public.spis_smazat(text, bigint)       from public;
revoke execute on function public.spis_jmena(text, jsonb)         from public;
grant  execute on function public.spis_zalozit(text, jsonb)       to anon, authenticated;
grant  execute on function public.spis_nacist(text)               to anon, authenticated;
grant  execute on function public.spis_zapsat(text, text, text)   to anon, authenticated;
grant  execute on function public.spis_smazat(text, bigint)       to anon, authenticated;
grant  execute on function public.spis_jmena(text, jsonb)         to anon, authenticated;

notify pgrst, 'reload schema';
