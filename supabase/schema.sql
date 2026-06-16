-- Jalankan file ini di Supabase SQL Editor sebelum mengaktifkan environment variable Supabase.
-- Server memakai service role key dari backend, jadi tabel tidak dibuka untuk akses publik.

create table if not exists public.ppdb_meta (
  id text primary key default 'default',
  school_name text not null default 'SMAN 2 NGAWI',
  registration_year text not null default '2026',
  last_sequence integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.ppdb_applicants (
  registration_number text primary key,
  nisn text not null unique,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ppdb_applicants_created_at_idx
  on public.ppdb_applicants (created_at);

create index if not exists ppdb_applicants_data_pathway_idx
  on public.ppdb_applicants ((data->>'pathway'));

alter table public.ppdb_meta enable row level security;
alter table public.ppdb_applicants enable row level security;

insert into public.ppdb_meta (id, school_name, registration_year, last_sequence)
values ('default', 'SMAN 2 NGAWI', '2026', 0)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ppdb-documents',
  'ppdb-documents',
  false,
  5242880,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.ppdb_next_registration_number(p_registration_year text)
returns table(last_sequence integer, registration_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  next_sequence integer;
begin
  insert into public.ppdb_meta (id, school_name, registration_year, last_sequence)
  values ('default', 'SMAN 2 NGAWI', p_registration_year, 0)
  on conflict (id) do nothing;

  update public.ppdb_meta
  set
    registration_year = p_registration_year,
    last_sequence = coalesce(public.ppdb_meta.last_sequence, 0) + 1
  where id = 'default'
  returning public.ppdb_meta.last_sequence into next_sequence;

  return query
  select
    next_sequence,
    'PPDB-' || p_registration_year || '-' || lpad(next_sequence::text, 4, '0');
end;
$$;

grant execute on function public.ppdb_next_registration_number(text) to service_role;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.ppdb_meta to service_role;
grant select, insert, update, delete on public.ppdb_applicants to service_role;
