-- ============================================================
-- CDA — Schema database Supabase
--
-- COME USARLO:
-- 1. Crea un progetto gratuito su supabase.com
-- 2. Vai su "SQL Editor" (menu a sinistra) > "New query"
-- 3. Incolla tutto questo file e premi "Run"
-- 4. Fatto: le tabelle, i permessi e le categorie di partenza sono creati.
--
-- Questo file è sicuro da rieseguire più volte (usa "if not exists" e
-- "on conflict do nothing"): se lo lanci di nuovo dopo un tentativo
-- parziale o fallito, completa solo quello che manca senza duplicare nulla.
--
-- NB: se il tuo progetto Supabase è stato creato PRIMA di questa versione
-- del file (aveva ancora la tabella "subcategories" separata), non
-- rilanciare questo schema da capo: esegui invece
-- supabase/migrations/006_gerarchia_categorie.sql, pensato apposta per
-- aggiornare un progetto già esistente senza perdere nulla.
-- ============================================================

-- ============================================
-- CATEGORIE — albero a profondità variabile
-- Una singola tabella auto-referenziata (parent_id): ogni ramo può
-- fermarsi a Categoria → Sottocategoria (2 livelli) oppure scendere a
-- un 3° livello (Tipologia) solo dove il catalogo lo richiede davvero.
-- "path" è il percorso leggibile tipo "interni.arredamento", utile per
-- breadcrumb e query senza bisogno di CTE ricorsive lato client.
-- ============================================
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references categories(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  sort_order int not null default 0,
  depth int not null default 1,
  path text,
  created_at timestamptz not null default now()
);

-- Lo slug è unico solo tra fratelli (es. "aperture" esiste sia sotto
-- Interni sia sotto Esterni), non a livello globale.
drop index if exists categories_top_level_slug_idx;
drop index if exists categories_child_slug_idx;
create unique index categories_top_level_slug_idx on categories (slug) where parent_id is null;
create unique index categories_child_slug_idx on categories (parent_id, slug) where parent_id is not null;

-- ============================================
-- PRODOTTI
-- category_id punta sempre al nodo FOGLIA della gerarchia, qualunque
-- sia la sua profondità (1, 2 o 3 livelli) — nessuna colonna separata
-- per "sottocategoria": è lo stesso albero categories a qualsiasi livello.
-- ============================================
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id) on delete set null,
  slug text unique not null,
  name text not null,
  description text,
  price_cents int not null check (price_cents >= 0), -- prezzo in centesimi, es. 3490 = 34,90€
  currency text not null default 'EUR',
  image_url text,
  stock int not null default 0,
  active boolean not null default true, -- se false, non compare nello shop
  featured boolean not null default false, -- per i badge "Più venduto"/"Novità"
  brand text, -- es. Dometic, Thetford, Vitrifrigo... per il filtro marca
  vehicle_compatibility text not null default 'universale', -- 'universale' = compatibile con tutti i mezzi, oppure: ducato | ducato-maxi | sprinter | daily | transit | altro
  is_bundle boolean not null default false, -- true = questo prodotto è un kit che raggruppa altri prodotti (vedi bundle_items)
  product_type text, -- breadcrumb leggibile per il feed Google Shopping, es. "Interni > Arredamento > Sportelloni"
  google_product_category text, -- ID tassonomia ufficiale Google, da compilare quando attivate il feed
  created_at timestamptz not null default now()
);

-- Nel caso la tabella products esistesse già da un tentativo precedente
-- senza queste colonne, le aggiunge senza toccare i dati esistenti.
alter table products add column if not exists brand text;
alter table products add column if not exists vehicle_compatibility text not null default 'universale';
alter table products add column if not exists is_bundle boolean not null default false;
alter table products add column if not exists product_type text;
alter table products add column if not exists google_product_category text;

-- ============================================
-- ATTRIBUTI TECNICI DEI PRODOTTI
-- Marca/compatibilità/dimensioni/potenza ecc. sono attributi filtrabili
-- sul prodotto, MAI nuove categorie. Es: key='potenza_w', value='150', unit='W'.
-- ============================================
create table if not exists product_attributes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  key text not null,
  value text not null,
  unit text,
  created_at timestamptz not null default now(),
  unique (product_id, key)
);

-- ============================================
-- CONTENUTO DEI KIT
-- Un kit è un prodotto normale (is_bundle = true) con un proprio prezzo;
-- questa tabella elenca quali prodotti reali contiene, per mostrare
-- "Cosa include questo kit" e calcolare il risparmio rispetto
-- all'acquisto separato dei singoli componenti.
-- ============================================
create table if not exists bundle_items (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references products(id) on delete cascade,
  component_product_id uuid not null references products(id) on delete restrict,
  quantity int not null default 1 check (quantity > 0),
  created_at timestamptz not null default now()
);

-- ============================================
-- RICHIESTE DI PREVENTIVO
-- (arrivano dal form in contatti.html: manutenzione, impianti,
--  installazione, riparazioni, lavorazioni speciali, info shop)
-- ============================================
create table if not exists quote_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  request_type text not null,
  message text,
  source_page text,
  status text not null default 'new', -- new | contacted | closed
  created_at timestamptz not null default now()
);

-- ============================================
-- ISCRIZIONI NEWSLETTER / REMARKETING
-- Cattura email per remarketing (Meta/email marketing), separata dalle
-- richieste di preventivo: qui non c'è intento d'acquisto immediato.
-- ============================================
create table if not exists newsletter_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source_page text,
  created_at timestamptz not null default now(),
  unique (email)
);

-- ============================================
-- ORDINI (fase 2 — attivi quando colleghiamo Stripe)
-- ============================================
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  shipping_address text,
  status text not null default 'pending', -- pending | paid | shipped | completed | cancelled
  total_cents int not null default 0,
  stripe_session_id text,
  created_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  product_id uuid references products(id),
  quantity int not null check (quantity > 0),
  unit_price_cents int not null,
  created_at timestamptz not null default now()
);

-- ============================================
-- RECENSIONI CLIENTI
-- Per aggiungerne una: Table Editor > testimonials > Insert row, con
-- customer_name e review_text (active è true di default). Finché la
-- tabella è vuota, il sito non mostra la sezione recensioni.
-- ============================================
create table if not exists testimonials (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  review_text text not null,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================
-- IMPOSTAZIONI GENERALI DEL SITO
-- Riga unica (id sempre 1). Compila delivery_time_text dal Table Editor
-- quando hai un tempo di consegna medio reale (es. "5-7 giorni lavorativi").
-- ============================================
create table if not exists site_settings (
  id int primary key default 1 check (id = 1),
  delivery_time_text text,
  created_at timestamptz not null default now()
);

insert into site_settings (id) values (1) on conflict (id) do nothing;

-- ============================================
-- SICUREZZA (Row Level Security)
-- Regola generale: il sito pubblico può SOLO leggere prodotti/categorie
-- e SOLO inserire richieste di preventivo. Non può mai leggere gli
-- ordini altrui né modificare/cancellare nulla.
-- ============================================

alter table categories enable row level security;
drop policy if exists "categories_public_read" on categories;
create policy "categories_public_read" on categories for select using (true);

alter table products enable row level security;
drop policy if exists "products_public_read" on products;
create policy "products_public_read" on products for select using (active = true);

alter table product_attributes enable row level security;
drop policy if exists "product_attributes_public_read" on product_attributes;
create policy "product_attributes_public_read" on product_attributes for select using (
  exists (select 1 from products p where p.id = product_attributes.product_id and p.active = true)
);

alter table bundle_items enable row level security;
drop policy if exists "bundle_items_public_read" on bundle_items;
create policy "bundle_items_public_read" on bundle_items for select using (true);

alter table quote_requests enable row level security;
drop policy if exists "quote_requests_public_insert" on quote_requests;
create policy "quote_requests_public_insert" on quote_requests for insert with check (true);
-- Le richieste si leggono dal pannello Supabase (Table Editor), non dal sito pubblico.

alter table newsletter_signups enable row level security;
drop policy if exists "newsletter_signups_public_insert" on newsletter_signups;
create policy "newsletter_signups_public_insert" on newsletter_signups for insert with check (true);

alter table testimonials enable row level security;
drop policy if exists "testimonials_public_read" on testimonials;
create policy "testimonials_public_read" on testimonials for select using (active = true);
-- Nessuna policy di insert/update pubblica: si aggiungono solo dal Table Editor.

alter table site_settings enable row level security;
drop policy if exists "site_settings_public_read" on site_settings;
create policy "site_settings_public_read" on site_settings for select using (true);

alter table orders enable row level security;
alter table order_items enable row level security;
-- Nessuna policy pubblica qui di proposito: solo una funzione server-side
-- (Edge Function, con la service_role key, mai esposta nel browser) potrà scriverci.

-- ============================================
-- CATEGORIE E SOTTOCATEGORIE DELLO SHOP (2 livelli oggi; un 3° livello
-- si aggiunge in futuro solo dove serve, con un semplice insert in più)
-- ============================================
insert into categories (slug, name, sort_order, depth, path) values
  ('interni', 'Interni', 1, 1, 'interni'),
  ('esterni', 'Esterni', 2, 1, 'esterni'),
  ('energia', 'Energia', 3, 1, 'energia'),
  ('acqua', 'Acqua', 4, 1, 'acqua'),
  ('clima', 'Clima', 5, 1, 'clima')
on conflict (slug) where parent_id is null do nothing;

insert into categories (parent_id, slug, name, sort_order, depth, path)
select c.id, v.slug, v.name, v.sort_order, 2, c.slug || '.' || v.slug from categories c, (values
  ('arredamento', 'Arredamento', 1), ('toilette', 'Toilette', 2), ('cucina', 'Cucina', 3),
  ('garage', 'Garage', 4), ('oscuranti', 'Oscuranti', 5), ('zanzariere', 'Zanzariere', 6),
  ('aperture', 'Aperture', 7), ('cabina-guida', 'Cabina Guida', 8), ('utensili', 'Utensili', 9)
) as v(slug, name, sort_order) where c.slug = 'interni' and c.parent_id is null
on conflict (parent_id, slug) where parent_id is not null do nothing;

insert into categories (parent_id, slug, name, sort_order, depth, path)
select c.id, v.slug, v.name, v.sort_order, 2, c.slug || '.' || v.slug from categories c, (values
  ('aperture', 'Aperture', 1), ('verande', 'Verande', 2), ('portaggio', 'Portaggio', 3)
) as v(slug, name, sort_order) where c.slug = 'esterni' and c.parent_id is null
on conflict (parent_id, slug) where parent_id is not null do nothing;

insert into categories (parent_id, slug, name, sort_order, depth, path)
select c.id, v.slug, v.name, v.sort_order, 2, c.slug || '.' || v.slug from categories c, (values
  ('batterie', 'Batterie', 1), ('pannelli-solari', 'Pannelli Solari', 2), ('strumentazioni', 'Strumentazioni', 3)
) as v(slug, name, sort_order) where c.slug = 'energia' and c.parent_id is null
on conflict (parent_id, slug) where parent_id is not null do nothing;

insert into categories (parent_id, slug, name, sort_order, depth, path)
select c.id, v.slug, v.name, v.sort_order, 2, c.slug || '.' || v.slug from categories c, (values
  ('prodotti-chimici', 'Prodotti Chimici', 1), ('pompe', 'Pompe', 2), ('serbatoi', 'Serbatoi', 3), ('rubinetteria', 'Rubinetteria', 4)
) as v(slug, name, sort_order) where c.slug = 'acqua' and c.parent_id is null
on conflict (parent_id, slug) where parent_id is not null do nothing;

insert into categories (parent_id, slug, name, sort_order, depth, path)
select c.id, v.slug, v.name, v.sort_order, 2, c.slug || '.' || v.slug from categories c, (values
  ('climatizzatori', 'Climatizzatori', 1), ('riscaldatori-gasolio-gas', 'Riscaldatori a Gasolio e Gas', 2)
) as v(slug, name, sort_order) where c.slug = 'clima' and c.parent_id is null
on conflict (parent_id, slug) where parent_id is not null do nothing;
