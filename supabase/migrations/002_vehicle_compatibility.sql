-- ============================================================
-- Migrazione: aggiunge la compatibilità veicolo ai prodotti
--
-- Hai già eseguito schema.sql in precedenza (le tabelle esistono già),
-- quindi esegui SOLO questo file aggiuntivo nell'SQL Editor di Supabase.
-- Non serve rieseguire schema.sql: darebbe errore "tabella già esistente".
-- ============================================================

alter table products
  add column if not exists vehicle_compatibility text not null default 'universale';

-- Valori validi consigliati (coerenti col filtro sullo shop):
-- 'universale' (va bene per qualsiasi mezzo, mostrato sempre)
-- 'ducato', 'ducato-maxi', 'sprinter', 'daily', 'transit', 'altro'
