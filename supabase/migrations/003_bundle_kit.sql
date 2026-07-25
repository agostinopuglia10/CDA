-- ============================================================
-- Migrazione: supporto kit/bundle (più prodotti venduti insieme)
--
-- Esegui SOLO questo file nell'SQL Editor di Supabase — le altre
-- tabelle esistono già da schema.sql.
-- ============================================================

alter table products
  add column if not exists is_bundle boolean not null default false;

create table if not exists bundle_items (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references products(id) on delete cascade,
  component_product_id uuid not null references products(id) on delete restrict,
  quantity int not null default 1 check (quantity > 0),
  created_at timestamptz not null default now()
);

alter table bundle_items enable row level security;
create policy "bundle_items_public_read" on bundle_items for select using (true);

-- Come creare un kit, in pratica:
-- 1. Crea un prodotto normale per ogni componente (es. "Pannello solare 200W", "Regolatore MPPT", "Cablaggio")
-- 2. Crea un altro prodotto per il kit stesso, con is_bundle = true e il SUO prezzo (scontato)
-- 3. In bundle_items, aggiungi una riga per ogni componente incluso, con bundle_id = id del kit
