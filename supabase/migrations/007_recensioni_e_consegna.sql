-- ============================================================
-- Migrazione: recensioni clienti reali + tempo di consegna medio
--
-- Perché: oggi non esistono ancora né recensioni vere né un tempo di
-- consegna noto. Invece di lasciare testi segnaposto sul sito, queste
-- due tabelle permettono al proprietario di aggiungerli in futuro dal
-- Table Editor di Supabase (senza toccare il codice). Finché restano
-- vuote, il sito non mostra nulla in quei punti (vedi initTestimonials()
-- e initDeliveryInfo() in js/main.js).
--
-- Esegui SOLO questo file nell'SQL Editor di Supabase.
-- ============================================================

-- ============================================
-- RECENSIONI CLIENTI
-- Per aggiungerne una: Table Editor > testimonials > Insert row.
-- Basta compilare customer_name e review_text (active è già true di
-- default). Per nasconderne una senza cancellarla, basta mettere
-- active = false. sort_order controlla l'ordine di comparsa (0 = prima).
-- ============================================
create table if not exists testimonials (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  review_text text not null,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table testimonials enable row level security;
drop policy if exists "testimonials_public_read" on testimonials;
create policy "testimonials_public_read" on testimonials for select using (active = true);
-- Nessuna policy di insert/update pubblica: le recensioni si aggiungono
-- solo dal Table Editor di Supabase (accesso riservato al proprietario).

-- ============================================
-- IMPOSTAZIONI GENERALI DEL SITO
-- Riga unica (id sempre 1). Per compilare il tempo di consegna:
-- Table Editor > site_settings > apri l'unica riga > scrivi in
-- delivery_time_text (es. "5-7 giorni lavorativi") > salva.
-- ============================================
create table if not exists site_settings (
  id int primary key default 1 check (id = 1),
  delivery_time_text text,
  created_at timestamptz not null default now()
);

insert into site_settings (id) values (1) on conflict (id) do nothing;

alter table site_settings enable row level security;
drop policy if exists "site_settings_public_read" on site_settings;
create policy "site_settings_public_read" on site_settings for select using (true);
-- Anche qui: si modifica solo dal Table Editor di Supabase, mai dal sito pubblico.
