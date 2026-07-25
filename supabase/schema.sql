-- ============================================================
-- CDA — Schema database Supabase
--
-- COME USARLO:
-- 1. Crea un progetto gratuito su supabase.com
-- 2. Vai su "SQL Editor" (menu a sinistra) > "New query"
-- 3. Incolla tutto questo file e premi "Run"
-- 4. Fatto: le tabelle, i permessi e le categorie di partenza sono creati.
-- ============================================================

-- ============================================
-- CATEGORIE (le 6 categorie dello Shop)
-- ============================================
create table categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================
-- PRODOTTI
-- ============================================
create table products (
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
  vehicle_compatibility text not null default 'universale', -- 'universale' = compatibile con tutti i mezzi, oppure: ducato | ducato-maxi | sprinter | daily | transit | altro
  is_bundle boolean not null default false, -- true = questo prodotto è un kit che raggruppa altri prodotti (vedi bundle_items)
  created_at timestamptz not null default now()
);

-- ============================================
-- CONTENUTO DEI KIT
-- Un kit è un prodotto normale (is_bundle = true) con un proprio prezzo;
-- questa tabella elenca quali prodotti reali contiene, per mostrare
-- "Cosa include questo kit" e calcolare il risparmio rispetto
-- all'acquisto separato dei singoli componenti.
-- ============================================
create table bundle_items (
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
create table quote_requests (
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
-- ORDINI (fase 2 — attivi quando colleghiamo Stripe)
-- ============================================
create table orders (
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

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  product_id uuid references products(id),
  quantity int not null check (quantity > 0),
  unit_price_cents int not null,
  created_at timestamptz not null default now()
);

-- ============================================
-- SICUREZZA (Row Level Security)
-- Regola generale: il sito pubblico può SOLO leggere prodotti/categorie
-- e SOLO inserire richieste di preventivo. Non può mai leggere gli
-- ordini altrui né modificare/cancellare nulla.
-- ============================================

alter table categories enable row level security;
create policy "categories_public_read" on categories for select using (true);

alter table products enable row level security;
create policy "products_public_read" on products for select using (active = true);

alter table bundle_items enable row level security;
create policy "bundle_items_public_read" on bundle_items for select using (true);

alter table quote_requests enable row level security;
create policy "quote_requests_public_insert" on quote_requests for insert with check (true);
-- Le richieste si leggono dal pannello Supabase (Table Editor), non dal sito pubblico.

alter table orders enable row level security;
alter table order_items enable row level security;
-- Nessuna policy pubblica qui di proposito: solo una funzione server-side
-- (Edge Function, con la service_role key, mai esposta nel browser) potrà scriverci.

-- ============================================
-- CATEGORIE DI PARTENZA (placeholder — da rinominare con quelle reali)
-- ============================================
insert into categories (slug, name, sort_order) values
  ('categoria-1', 'Categoria 1', 1),
  ('categoria-2', 'Categoria 2', 2),
  ('categoria-3', 'Categoria 3', 3),
  ('categoria-4', 'Categoria 4', 4),
  ('categoria-5', 'Categoria 5', 5),
  ('categoria-6', 'Categoria 6', 6);
