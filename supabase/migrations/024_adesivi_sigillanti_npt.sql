-- Sottocategoria "Adesivi e Sigillanti" dentro Esterni + 6 prodotti NPT.
-- Costi, prezzi e giacenze forniti da Agostino il 08/10/2026 (file "NPT prodotti.md"); descrizioni dalle schede tecniche NPT (nptsrl.com).
-- G+S Cleaner (aerosol) e Activator 400 NP (infiammabile) restano active=false finche' non si verifica con la spedizioniera
-- se si possono spedire. Foto dei colori/accessori mancanti (SiMP bianco, miscelatore) provvisorie: da sostituire con quelle scattate in officina.

insert into categories (slug, name, description, sort_order, parent_id, path, depth)
select 'adesivi-sigillanti', 'Adesivi e Sigillanti',
  'Sigillanti elastici, adesivi strutturali e detergenti/attivatori per incollaggi e sigillature su tetto, finestre, carrozzeria e plastiche del camper.',
  6, 'd5e19700-4d5e-40fd-928f-ac03fe4013d3', 'esterni.adesivi-sigillanti', 2
where not exists (select 1 from categories where path = 'esterni.adesivi-sigillanti');

insert into products (category_id, slug, name, description, price_cents, currency, image_url, stock, active, featured, brand, is_bundle, weight_kg, shipping_included, long_package, ships_on_pallet, google_product_category, datasheet_url)
select c.id, v.slug, v.name, v.description, v.price_cents, 'EUR', v.image_url, v.stock, v.active, false, 'NPT', false, v.weight_kg, false, false, false, 'Hardware > Hardware Accessories', v.datasheet_url
from categories c
cross join (values
 ('cda-0184-npt-tak-3-adesivo-cianoacrilico-20-g',
  'NPT Sigill Tak 3 adesivo cianoacrilico 20 g',
  $d$Adesivo cianoacrilico incolore NPT Sigill Tak 3 a bassa viscosità, in flacone da 20 g. Monocomponente a presa ultra-rapida e senza solventi organici, incolla in pochi secondi varie materie plastiche e gomme: tempo di presa inferiore a 15 secondi su EPDM, ABS e pelle, inferiore a 40 secondi su acciaio e policarbonato. Resistenza termica da -60 a +80 °C. Le superfici devono essere asciutte, pulite, sgrassate e combaciare bene: basta una goccia. Prodotto classificato pericoloso (contiene cianoacrilati): consultare la scheda di sicurezza. Conservazione 12 mesi dalla produzione tra 5 e 20 °C. Spedizione in tutta Italia o ritiro gratis nella nostra officina di Tivoli.$d$,
  600, 'images/prodotti/cda-0184-npt-tak-3-adesivo-cianoacrilico-20-g.jpg', 12, true, 0.05, 'docs/certificazioni/npt-tak-3-scheda-tecnica.pdf'),
 ('cda-0185-npt-simp-seal-650-bianco-290-ml',
  'NPT SiMP-Seal 650 adesivo sigillante bianco 290 ml',
  $d$Adesivo elastico e sigillante NPT SiMP-Seal 650 bianco, cartuccia da 290 ml. Monocomponente a base di polimero silil-modificato (SiMP), completamente inodore, senza solventi e isocianati, con VOC pari a zero e nessun simbolo di pericolo in etichetta; certificato EMICODE EC1 PLUS. Aderisce senza primer sui materiali tipici da costruzione e industriali, non cola, non forma bolle e resta flessibile da -40 a +150 °C. Sovraverniciabile (prove preliminari consigliate). Durezza Shore A circa 58, allungamento a rottura circa 250%, applicazione da +5 a +40 °C. La scheda del produttore lo indica per sigillature e incollaggi elastici su caravan, trasporti e nautica. Serve una pistola per cartucce (non inclusa). Conservazione 12 mesi in confezione originale. Spedizione in tutta Italia o ritiro gratis nella nostra officina di Tivoli.$d$,
  1200, 'images/prodotti/cda-0185-npt-simp-seal-650-bianco-290-ml.jpg', 120, true, 0.47, 'docs/certificazioni/npt-simp-seal-650-scheda-tecnica.pdf'),
 ('cda-0186-npt-activator-400-np-250-ml',
  'NPT Activator 400 NP promotore di adesione 250 ml',
  $d$Promotore di adesione NPT Activator 400 NP in bottiglia di alluminio da 250 ml, per migliorare l'adesione degli adesivi U-Seal e SiMP-Seal su supporti non porosi: plastica e fibra di vetro, superfici verniciate, metalli (acciaio, inox, alluminio, rame) e vetro. Si applica con un panno senza pelucchi o una spugna leggermente abrasiva; si lascia asciugare circa 10 minuti e si applica il sigillante entro 2 ore. Consumo circa 40 ml/m², applicazione da +5 a +35 °C. Prodotto infiammabile: richiudere bene il flacone e consumarlo entro una settimana dall'apertura. Non usare per lisciare i sigillanti. Consultare la scheda di sicurezza.$d$,
  1700, 'images/prodotti/cda-0186-npt-activator-400-np-250-ml.jpg', 24, false, 0.30, 'docs/certificazioni/npt-activator-400-np-scheda-tecnica.pdf'),
 ('cda-0187-npt-gs-cleaner-spray-600-ml',
  'NPT G+S Cleaner pulitore schiumogeno spray 600 ml',
  $d$Pulitore schiumogeno professionale NPT G+S Cleaner, bomboletta spray da 600 ml, a base acqua. Rimuove sporco e contaminanti senza lasciare aloni e prepara le superfici prima di adesivi e sigillanti NPT; si usa su vetro, metalli, ceramica, superfici verniciate e plastica. Serve anche come lisciante per i cordoni di sigillante appena applicati e come pulitore a secco per parti esterne, tappezzeria e cruscotti (provare prima su una zona nascosta). Agitare prima dell'uso, applicare con spugna abrasiva o panno senza pelucchi, da 0 a +40 °C. Conservazione 24 mesi tra 10 e 25 °C.$d$,
  1400, 'images/prodotti/cda-0187-npt-gs-cleaner-spray-600-ml.jpg', 36, false, 0.55, 'docs/certificazioni/npt-gs-cleaner-scheda-tecnica.pdf'),
 ('cda-0188-npt-u-bond-ultra-2k-1-min-50-ml',
  'NPT U-Bond Ultra 2K 1 min adesivo poliuretanico 50 ml',
  $d$Adesivo poliuretanico bicomponente NPT U-Bond Ultra 2K, versione da 1 minuto, siringa doppia da 50 ml con miscelatore statico. Per riparare e incollare parti in plastica verniciabili (paraurti, spoiler, staffe, occhielli rotti) e per riempire fessure; incolla anche acciaio, alluminio e vetro. A 23 °C e 50% di umidità: tempo di lavorazione circa 1 minuto, manipolabile in circa 5 minuti, indurimento completo in circa 4 ore. Pasta tissotropica grigia che non cola, carteggiabile e sovraverniciabile, senza solventi e inodore. Durezza Shore D circa 80, resistenza a trazione circa 23 N/mm², da -30 a +100 °C, applicazione da +10 a +30 °C. Serve una pistola manuale per cartucce doppie (non inclusa). Conservazione 12 mesi in confezione originale. Spedizione in tutta Italia o ritiro gratis nella nostra officina di Tivoli.$d$,
  1300, 'images/prodotti/cda-0188-npt-u-bond-ultra-2k-1-min-50-ml.jpg', 12, true, 0.10, 'docs/certificazioni/npt-u-bond-ultra-2k-scheda-tecnica.pdf'),
 ('cda-0189-npt-miscelatore-ricambio-u-bond-ultra-2k',
  'NPT Miscelatore di ricambio per U-Bond Ultra 2K',
  $d$Miscelatore statico di ricambio a 16 elementi per le siringhe NPT U-Bond Ultra 2K da 50 ml, con attacco a baionetta. Secondo la scheda del produttore 16 elementi sono il numero giusto per una miscelazione completa; il miscelatore è monouso e va sostituito quando il prodotto indurisce al suo interno. Spedizione in tutta Italia o ritiro gratis nella nostra officina di Tivoli.$d$,
  150, 'images/prodotti/cda-0189-npt-miscelatore-ricambio-u-bond-ultra-2k.jpg', 24, true, 0.02, 'docs/certificazioni/npt-u-bond-ultra-2k-scheda-tecnica.pdf')
) as v(slug, name, description, price_cents, image_url, stock, active, weight_kg, datasheet_url)
where c.path = 'esterni.adesivi-sigillanti'
  and not exists (select 1 from products p where p.slug = v.slug);
