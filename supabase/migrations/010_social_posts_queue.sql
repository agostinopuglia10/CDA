-- Coda dei post organici per Facebook/Instagram (Fase 1 del Piano
-- Pubblicità nel Dossier CDA). Ogni riga è un post pronto da pubblicare
-- in automatico tramite la Edge Function publish-scheduled-post.
--
-- Gate di sicurezza voluto: una riga viene pubblicata SOLO se
-- status = 'ready' E image_url è valorizzato. Finché non scegli tu di
-- portare una riga a 'ready' (dopo aver messo l'immagine vera), resta
-- 'draft' e l'automazione la ignora. Cambiare status è l'equivalente di
-- premere "pubblica": fallo da Supabase -> Table Editor -> social_posts.

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  sort_order integer not null,
  headline text not null,
  caption text not null,
  hashtags text not null,
  price_cents integer,
  image_url text,
  status text not null default 'draft' check (status in ('draft', 'ready', 'published', 'failed')),
  external_post_id text,
  error_message text,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.social_posts enable row level security;
-- Nessuna policy pubblica: solo il service role (usato dalla Edge
-- Function e dalla dashboard Supabase) può leggere o scrivere qui,
-- stesso schema già usato per la tabella orders.

insert into public.social_posts (slug, sort_order, headline, caption, hashtags, price_cents)
values
(
  'kit-toilette-viaggio', 1,
  'Il primo acquisto giusto, non il primo che capita',
  E'Hai appena preso il tuo primo camper e la lista di cose da comprare non finisce mai?\n\nIl dubbio più comune di chi parte da zero non è "qual è l''accessorio più bello", è "cosa mi serve davvero per primo". Il Kit Toilette da Viaggio mette insieme tutto il necessario in un''unica soluzione pensata per chi comincia — niente scelte pezzo per pezzo, niente sorprese.\n\nDisponibile nello shop, link in bio.',
  '#camperlife #primocamper #camperisti #vitainviaggio #campertivoli #accessoricamper',
  14900
),
(
  'kit-impianto-acqua-fissa', 2,
  'Il comfort di casa, anche a 300 km da casa',
  E'Niente taniche da riempire ogni due giorni, niente pezzi sciolti da montare da soli nel weekend.\n\nIl Kit Impianto Acqua Fissa porta il comfort dell''acqua corrente nel camper con un impianto pensato per funzionare da subito — non per essere un altro progetto fai-da-te.\n\nDisponibile nello shop, link in bio.',
  '#camperlife #comfort #vitaincamper #accessoricamper #campertivoli',
  19400
),
(
  'kit-garage-da-viaggio', 3,
  'Quello che porti nel garage, in frenata, torna indietro',
  E'Un carico non fissato bene nel garage del camper non è solo scomodo: in frenata può diventare un rischio vero, ed è uno dei temi che torna più spesso nei forum di chi viaggia.\n\nIl Kit Garage da Viaggio blocca il carico dove deve stare, con un sistema pensato per restare fermo anche quando il viaggio non lo è.\n\nDisponibile nello shop, link in bio.',
  '#sicurezzacamper #camperlife #viaggiareincamper #campertivoli #accessoricamper',
  17900
),
(
  'kit-comfort-cabina-guida', 4,
  'Il tuo camper ha qualche stagione alle spalle? Anche la cabina merita un aggiornamento',
  E'Non serve un camper nuovo per sentirlo di nuovo. Il Kit Comfort Cabina Guida è pensato per chi il camper lo ha già da un po'' e vuole un miglioramento rapido, senza stravolgere niente.\n\nDisponibile nello shop, link in bio.',
  '#camperlife #upgrade #vitaincamper #campertivoli',
  25900
),
(
  'kit-riscaldamento-invernale', 5,
  'Chi l''ha detto che il camper va in letargo d''inverno?',
  E'Il turismo in camper in Italia sta crescendo più in fretta della media europea — e sempre più camperisti non si fermano più a settembre.\n\nIl Kit Riscaldamento Invernale rende il camper vivibile anche quando fuori fa freddo, per chi non vuole aspettare la prossima estate per ripartire.\n\nDisponibile nello shop, link in bio.',
  '#camperinverno #camperlife #viaggiareincamper #campertivoli',
  74900
),
(
  'kit-veranda-motorizzata', 6,
  'Per chi il camper non lo vive un weekend all''anno, ma ogni weekend',
  E'Una veranda motorizzata non è un capriccio: è lo spazio in più che trasforma ogni sosta in un soggiorno vero, con un marchio che chi viaggia da anni conosce già.\n\nKit Veranda Motorizzata (Thule) — l''investimento giusto per chi il camper lo usa sul serio.\n\nDisponibile nello shop, link in bio.',
  '#camperlife #veranda #vitaincamper #campertivoli #thule',
  96900
),
(
  'posizionamento-shop-officina', 7,
  'Lo compri online. Te lo montiamo qui, a Tivoli.',
  E'I grandi e-commerce di accessori camper hanno il catalogo, ma non installano niente. Le officine locali installano bene, ma non hanno un catalogo online vero.\n\nCDA è tra i pochi che uniscono le due cose nello stesso posto: ordini online, e chi risponde al telefono è la stessa persona che poi ti sistema il camper in officina a Tivoli.\n\nScopri come funziona — link in bio.',
  '#campertivoli #accessoricamper #camperlife #officinacamper #lazio',
  null
)
on conflict (slug) do nothing;
