-- ============================================================
-- Migrazione: categorie e sottocategorie reali dello Shop
--
-- Sostituisce le categorie segnaposto (Categoria 1-6) con la
-- struttura reale decisa: Interni, Esterni, Energia, Acqua, Clima.
--
-- Esegui SOLO questo file nell'SQL Editor di Supabase.
-- ============================================================

-- Rimuove le categorie/sottocategorie segnaposto (nessun prodotto le usa ancora)
delete from subcategories where category_id in (select id from categories where slug like 'categoria-%');
delete from categories where slug like 'categoria-%';

-- ============================================
-- CATEGORIE REALI
-- ============================================
insert into categories (slug, name, sort_order) values
  ('interni', 'Interni', 1),
  ('esterni', 'Esterni', 2),
  ('energia', 'Energia', 3),
  ('acqua', 'Acqua', 4),
  ('clima', 'Clima', 5);

-- ============================================
-- SOTTOCATEGORIE REALI
-- ============================================

-- Interni
insert into subcategories (category_id, slug, name, sort_order)
select id, v.slug, v.name, v.sort_order
from categories, (values
  ('arredamento', 'Arredamento', 1),
  ('toilette', 'Toilette', 2),
  ('cucina', 'Cucina', 3),
  ('garage', 'Garage', 4),
  ('oscuranti', 'Oscuranti', 5),
  ('zanzariere', 'Zanzariere', 6),
  ('aperture', 'Aperture', 7),
  ('cabina-guida', 'Cabina Guida', 8),
  ('utensili', 'Utensili', 9)
) as v(slug, name, sort_order)
where categories.slug = 'interni';

-- Esterni
insert into subcategories (category_id, slug, name, sort_order)
select id, v.slug, v.name, v.sort_order
from categories, (values
  ('aperture', 'Aperture', 1),
  ('verande', 'Verande', 2),
  ('portaggio', 'Portaggio', 3)
) as v(slug, name, sort_order)
where categories.slug = 'esterni';

-- Energia
insert into subcategories (category_id, slug, name, sort_order)
select id, v.slug, v.name, v.sort_order
from categories, (values
  ('batterie', 'Batterie', 1),
  ('pannelli-solari', 'Pannelli Solari', 2),
  ('strumentazioni', 'Strumentazioni', 3)
) as v(slug, name, sort_order)
where categories.slug = 'energia';

-- Acqua
insert into subcategories (category_id, slug, name, sort_order)
select id, v.slug, v.name, v.sort_order
from categories, (values
  ('prodotti-chimici', 'Prodotti Chimici', 1),
  ('pompe', 'Pompe', 2),
  ('serbatoi', 'Serbatoi', 3),
  ('rubinetteria', 'Rubinetteria', 4)
) as v(slug, name, sort_order)
where categories.slug = 'acqua';

-- Clima
insert into subcategories (category_id, slug, name, sort_order)
select id, v.slug, v.name, v.sort_order
from categories, (values
  ('climatizzatori', 'Climatizzatori', 1),
  ('riscaldatori-gasolio-gas', 'Riscaldatori a Gasolio e Gas', 2)
) as v(slug, name, sort_order)
where categories.slug = 'clima';
