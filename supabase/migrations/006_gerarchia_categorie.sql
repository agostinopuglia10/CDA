-- ============================================================
-- Migrazione: gerarchia categorie a profondità variabile
--
-- Sostituisce il modello fisso "categories + subcategories" (2 livelli
-- sempre uguali per tutti i rami) con un'unica tabella categories
-- auto-referenziata (parent_id), dove ogni ramo può fermarsi a 2 livelli
-- o scendere a un 3° livello (Tipologia) solo dove il catalogo lo
-- richiede davvero — senza toccare lo schema né il codice.
--
-- Sicura da rieseguire più volte. Nessun prodotto reale esiste ancora
-- nel catalogo, quindi questa migrazione non tocca dati di prodotti.
--
-- Esegui SOLO questo file nell'SQL Editor di Supabase, dopo aver già
-- eseguito schema.sql / le migrazioni precedenti.
-- ============================================================

-- ============================================
-- 1. Estendere categories con parent_id / path / depth
-- ============================================
alter table categories add column if not exists parent_id uuid references categories(id) on delete cascade;
alter table categories add column if not exists path text;
alter table categories add column if not exists depth int not null default 1;

-- Lo slug non deve più essere unico a livello globale (es. "aperture"
-- esiste sia sotto Interni sia sotto Esterni): unico solo tra fratelli.
alter table categories drop constraint if exists categories_slug_key;
drop index if exists categories_top_level_slug_idx;
drop index if exists categories_child_slug_idx;
create unique index categories_top_level_slug_idx on categories (slug) where parent_id is null;
create unique index categories_child_slug_idx on categories (parent_id, slug) where parent_id is not null;

-- ============================================
-- 2. Migrare le righe di subcategories dentro categories come figli
-- ============================================
insert into categories (parent_id, slug, name, description, sort_order, depth, path)
select s.category_id, s.slug, s.name, s.description, s.sort_order, 2,
       c.slug || '.' || s.slug
from subcategories s
join categories c on c.id = s.category_id
where not exists (
  select 1 from categories existing
  where existing.parent_id = s.category_id and existing.slug = s.slug
);

-- Path/depth per le categorie di primo livello (già esistenti prima di questa migrazione)
update categories set path = slug, depth = 1 where parent_id is null and path is null;

-- ============================================
-- 3. Ripuntare i prodotti al nuovo albero unificato
-- Il catalogo è vuoto oggi: questo passaggio è preventivo per quando
-- inizierete a inserire prodotti reali. category_id punta sempre al
-- nodo FOGLIA (che sia profondità 1, 2 o 3).
-- ============================================
alter table products add column if not exists product_type text; -- breadcrumb leggibile per feed Google Shopping, es. "Interni > Arredamento > Sportelloni"
alter table products add column if not exists google_product_category text; -- ID tassonomia ufficiale Google, da compilare quando attivate il feed

-- La vecchia colonna subcategory_id non serve più: category_id ora punta
-- sempre al nodo foglia dell'albero unificato, a qualsiasi profondità.
-- Il catalogo è vuoto, quindi non c'è nessun dato da rimappare.
alter table products drop column if exists subcategory_id;

-- ============================================
-- 4. Attributi tecnici strutturati (marca già coperta da products.brand)
-- Es: potenza, litri, watt, dimensioni — filtrabili, mai categorie.
-- ============================================
create table if not exists product_attributes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  key text not null,   -- es. 'potenza_w', 'capacita_ah', 'dimensioni_cm'
  value text not null,
  unit text,            -- es. 'W', 'Ah', 'cm'
  created_at timestamptz not null default now(),
  unique (product_id, key)
);

alter table product_attributes enable row level security;
drop policy if exists "product_attributes_public_read" on product_attributes;
create policy "product_attributes_public_read" on product_attributes for select using (
  exists (select 1 from products p where p.id = product_attributes.product_id and p.active = true)
);

-- ============================================
-- 5. NON eseguire subito: pulizia finale (facoltativa)
-- Una volta verificato che il sito funziona con il nuovo albero
-- categories, la vecchia tabella subcategories non serve più.
-- Lasciata commentata di proposito: cancellala solo quando sei sicuro.
-- ============================================
-- drop table if exists subcategories;
