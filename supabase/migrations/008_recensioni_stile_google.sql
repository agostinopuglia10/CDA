-- ============================================================
-- Migrazione: recensioni in stile "screenshot Google" (stelle + data)
--
-- Perché: le recensioni vere sono citazioni testuali prese da Google, ma
-- mostrate come semplice testo in corsivo sembravano inventate. Aggiungendo
-- voto (stelle) e "X anni fa" — dati reali presi dalla stessa recensione
-- Google, non stimati — la card assomiglia a uno screenshot autentico.
--
-- Esegui SOLO questo file nell'SQL Editor di Supabase (dopo 007).
-- ============================================================

alter table testimonials add column if not exists rating int not null default 5 check (rating between 1 and 5);
alter table testimonials add column if not exists review_date_label text;

comment on column testimonials.rating is 'Voto in stelle (1-5), copiato dalla recensione Google reale.';
comment on column testimonials.review_date_label is 'Data relativa mostrata da Google sulla recensione originale, es. "un anno fa" — testo libero, non una data calcolata.';

-- Backfill delle 5 recensioni già inserite (dati reali dalla scheda Google
-- Business di CDA, verificati il 24/09/2026 — vedi anche il link nella
-- scheda "Informazioni" del negozio).
update testimonials set rating = 5, review_date_label = 'un anno fa' where customer_name = 'Orquesta Típica Andariega';
update testimonials set rating = 5, review_date_label = '5 anni fa' where customer_name = 'Vincenzo Ierano';
update testimonials set rating = 5, review_date_label = '4 anni fa' where customer_name = 'Paolo Santandrea';
update testimonials set rating = 5, review_date_label = '5 anni fa' where customer_name = 'Pietro Cireddu';
update testimonials set rating = 5, review_date_label = '7 anni fa' where customer_name = 'Alessandro Burdo';
