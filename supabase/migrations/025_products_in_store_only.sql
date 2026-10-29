-- Prodotti non spedibili (aerosol, infiammabili): visibili sul sito, acquistabili solo in officina a Tivoli.
-- Global Service vieta merce infiammabile e bombolette spray/sotto pressione (verificato 08/10/2026).
alter table products add column if not exists in_store_only boolean not null default false;
update products set in_store_only = true, active = true
where slug in ('cda-0186-npt-activator-400-np-250-ml','cda-0187-npt-gs-cleaner-spray-600-ml');
