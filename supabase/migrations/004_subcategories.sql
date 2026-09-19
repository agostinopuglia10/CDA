-- ============================================================
-- Migrazione: sottocategorie (Categoria → Sottocategoria → Prodotto)
--
-- Esegui SOLO questo file nell'SQL Editor di Supabase — le altre
-- tabelle esistono già da schema.sql e dalle migrazioni precedenti.
-- ============================================================

create table if not exists subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (category_id, slug)
);

alter table products
  add column if not exists subcategory_id uuid references subcategories(id) on delete set null;

alter table products
  add column if not exists brand text; -- es. Dometic, Thetford, Vitrifrigo... per il filtro marca

alter table subcategories enable row level security;
create policy "subcategories_public_read" on subcategories for select using (true);

-- Esempio (facoltativo) per provare subito la struttura — cancellalo
-- quando crei le tue sottocategorie vere:
-- insert into subcategories (category_id, slug, name, sort_order)
-- select id, 'sottocategoria-1', 'Sottocategoria 1', 1 from categories where slug = 'categoria-1';
