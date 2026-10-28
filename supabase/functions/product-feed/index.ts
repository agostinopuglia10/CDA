// ============================================================
// Edge Function: product-feed
//
// COSA FA:
// Genera in tempo reale un feed prodotti in formato Google Shopping
// (RSS 2.0 con namespace g:) leggendo i prodotti direttamente dal
// database. Ogni volta che viene chiamata, il feed riflette lo stato
// attuale del catalogo: non serve rigenerarlo a mano.
//
// Include SOLO i prodotti che rispettano i requisiti minimi di Google
// Merchant Center (altrimenti Google li rifiuta comunque):
//   - active = true
//   - prezzo reale impostato (price_cents > 0)
//   - foto presente (image_url non vuoto)
// I prodotti senza foto o ancora a prezzo segnaposto (0€) restano
// fuori dal feed finché non li completi — non è un errore, è voluto.
//
// COME ATTIVARLA:
// 1. Installa la CLI di Supabase (una volta sola): npm install -g supabase
// 2. Nel terminale, dalla cartella del progetto:
//      supabase login
//      supabase link --project-ref udynqqqxjcyhdeygqumi
// 3. Pubblica la funzione:
//      supabase functions deploy product-feed --no-verify-jwt
//    (--no-verify-jwt perché Google Merchant deve poterla leggere
//    senza autenticazione, come un feed pubblico qualsiasi)
// 4. L'URL del feed sarà:
//      https://udynqqqxjcyhdeygqumi.supabase.co/functions/v1/product-feed
//    Questo è l'URL da incollare in Google Merchant Center sotto
//    "Feed" > "Aggiungi feed" > "Recupero pianificato".
//
// IMPORTANTE PRIMA DI ATTIVARE SU GOOGLE MERCHANT:
// - Dominio reale attivo dal 2026-09-03 (cda-camper.it) — questo blocco
//   è risolto, i link prodotto sono raggiungibili pubblicamente.
// - Le immagini attualmente collegate sono ospitate sui server dei
//   fornitori (Euro Accessoires Italia / GES): verifica di avere
//   l'autorizzazione scritta a usarle prima di metterle in un feed
//   pubblicitario attivo, non solo sul sito — questo resta da fare.
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SITE_URL = Deno.env.get('SITE_URL') || 'https://cda-camper.it';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const baseFields = 'id, slug, name, description, price_cents, compare_at_price_cents, currency, image_url, brand, stock, is_bundle, long_package, ships_on_pallet, shipping_included, weight_kg, google_product_category, gtin, categories(name, path)';
    const fetchProducts = (fields: string) => supabase
      .from('products')
      .select(fields)
      .eq('active', true)
      .eq('in_store_only', false) // aerosol/infiammabili: acquistabili solo in officina, niente Google Shopping
      .gt('price_cents', 0)
      .not('image_url', 'is', null)
      .neq('image_url', '');

    // additional_image_urls arriva con la migrazione 029: se la funzione viene distribuita prima
    // della migrazione, il feed continua a funzionare con la sola foto principale.
    let { data: products, error } = await fetchProducts(baseFields + ', additional_image_urls');
    if (error && /additional_image_urls/.test(error.message)) {
      ({ data: products, error } = await fetchProducts(baseFields));
    }

    if (error) {
      return new Response('Errore nel recupero prodotti: ' + error.message, { status: 500, headers: CORS_HEADERS });
    }

    // Stesse fasce del checkout (create-checkout-session): servono a dire a Google il costo
    // di spedizione vero di ogni prodotto, gratuita compresa.
    const { data: bands } = await supabase
      .from('shipping_rate_bands')
      .select('package_type, zona, weight_min_kg, price_cents');

    const items = (products || [])
      .map((p) => {
        // Pagina statica reale generata in build (scripts/build-product-pages.js),
        // non più il template condiviso con ?id= — Google Shopping preferisce
        // un URL diretto piuttosto che seguire un redirect ad ogni lettura feed.
        const link = `${SITE_URL}/prodotto-${p.slug}.html`;
        // Le foto caricate in locale (es. batterie/climatizzatori Ultimatron)
        // hanno un percorso relativo nel database (images/prodotti/...);
        // Google Merchant richiede sempre un URL assoluto, altrimenti scarta
        // il prodotto dal feed.
        const imageLink = absoluteUrl(p.image_url);
        // Foto in piu' (Merchant Center > Qualita' del negozio > Immagini per offerta): Google ne accetta fino a 10.
        const additionalImages = (p.additional_image_urls || [])
          .filter((u: string) => u && u.trim() && u !== p.image_url)
          .slice(0, 10)
          .map((u: string) => `<g:additional_image_link>${escapeXml(absoluteUrl(u.trim()))}</g:additional_image_link>`)
          .join('\n    ');
        // Costo di spedizione del prodotto comprato da solo, calcolato come nel checkout. Senza questo
        // Google usa le impostazioni dell'account, che non conoscono la spedizione gratuita da 150 €
        // (Qualita' del negozio: "Costo di spedizione discreto", media 14,99 € al 19/10).
        const shippingCents = itemShippingCents(p, bands || []);
        const shipping = shippingCents === null
          ? ''
          : `<g:shipping><g:country>IT</g:country><g:price>${(shippingCents / 100).toFixed(2)} EUR</g:price></g:shipping>`;
        const priceEUR = (p.price_cents / 100).toFixed(2);
        // Prezzo ribassato (lo stesso prezzo barrato mostrato sul sito): Google Shopping mostra il ribasso.
        const onSale = p.compare_at_price_cents && p.compare_at_price_cents > p.price_cents;
        const currency = (p.currency || 'EUR').toUpperCase();
        const availability = p.stock && p.stock > 0 ? 'in stock' : 'in stock'; // drop-ship: si spedisce dal fornitore alla ricezione dell'ordine
        const productType = p.categories?.path
          ? p.categories.path.split('.').map((s: string) => capitalize(s.replace(/-/g, ' '))).join(' > ')
          : '';
        // Etichetta usata in Google Merchant Center per applicare la norma di
        // spedizione giusta a ogni prodotto (Prodotti specifici > per etichetta):
        // "pallet" e "lungo" hanno un costo di spedizione diverso da quello a
        // peso standard, calcolato allo stesso modo del checkout del sito
        // (vedi products.ships_on_pallet / products.long_package).
        const shippingLabel = p.ships_on_pallet ? 'pallet' : p.long_package ? 'lungo' : 'normale';
        // Richiesto da Google Merchant per calcolare/approvare la spedizione
        // (senza questo campo il prodotto risulta "Non approvato": Peso del
        // pacco mancante [shipping_weight]). weight_kg è nullo per 12/169
        // prodotti (dato non ancora reperito, vedi ricerca-pesi-dimensioni-
        // prodotti.csv) — per quelli il tag resta omesso, non inventiamo pesi.
        const shippingWeight = p.weight_kg ? `<g:shipping_weight>${p.weight_kg} kg</g:shipping_weight>` : '';

        return `  <item>
    <g:id>${escapeXml(p.id)}</g:id>
    <title>${escapeXml(truncate(buildFeedTitle(p), 150))}</title>
    <description>${escapeXml(truncate(p.description || p.name, 5000))}</description>
    <link>${escapeXml(link)}</link>
    <g:image_link>${escapeXml(imageLink)}</g:image_link>
    ${additionalImages}
    <g:availability>${availability}</g:availability>
    <g:price>${onSale ? (p.compare_at_price_cents / 100).toFixed(2) : priceEUR} ${currency}</g:price>
    ${onSale ? `<g:sale_price>${priceEUR} ${currency}</g:sale_price>` : ''}
    <g:condition>new</g:condition>
    ${p.gtin ? `<g:gtin>${escapeXml(p.gtin)}</g:gtin>` : `<g:identifier_exists>no</g:identifier_exists>`}
    <g:shipping_label>${escapeXml(shippingLabel)}</g:shipping_label>
    ${p.google_product_category ? `<g:google_product_category>${escapeXml(p.google_product_category)}</g:google_product_category>` : ''}
    ${shippingWeight}
    ${shipping}
    ${p.brand ? `<g:brand>${escapeXml(p.brand)}</g:brand>` : ''}
    ${productType ? `<g:product_type>${escapeXml(productType)}</g:product_type>` : ''}
  </item>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>CDA Camper - Shop</title>
  <link>${escapeXml(SITE_URL)}</link>
  <description>Feed prodotti Shop Camper CDA - Tivoli (RM)</description>
${items}
</channel>
</rss>`;

    return new Response(xml, {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/xml; charset=UTF-8' },
    });
  } catch (err) {
    return new Response(err instanceof Error ? err.message : 'Errore sconosciuto', { status: 500, headers: CORS_HEADERS });
  }
});

// Titolo mostrato su Google Shopping. Il nome sul sito NON cambia: qui lo rendiamo piu'
// "cercabile" usando solo dati gia' presenti nel database (mai inventati):
//  1. "(blister)" diventa "- confezione blister" (resta distinguibile dalla versione sfusa);
//  2. se il prodotto ha una marca che non compare nel nome, la marca va davanti
//     (esclusi i kit CDA: brand "CDA" o bundle);
//  3. se il titolo e' molto corto (< 25 caratteri, es. "Cargo Strap", "Tank 70"),
//     si aggiunge la categoria del prodotto ("Cargo Strap - Garage").
function buildFeedTitle(p: { name: string; brand?: string | null; is_bundle?: boolean | null; categories?: { name?: string } | null }): string {
  let title = p.name.replace(/\s*\(blister\)\s*$/i, ' - confezione blister').trim();

  const brand = (p.brand || '').trim();
  if (brand && brand.toUpperCase() !== 'CDA' && !p.is_bundle && !title.toLowerCase().includes(brand.toLowerCase())) {
    title = `${brand} ${title}`;
  }

  const category = (p.categories?.name || '').trim();
  if (title.length < 25 && category && !title.toLowerCase().includes(category.toLowerCase())) {
    title = `${title} - ${category}`;
  }

  return addProductType(title, p);
}

// Titoli piu' "cercabili" per le sottocategorie con ricerche reali (Search Console, ultimi 3 mesi: riscaldatori
// Autoterm/Truma, climatizzatori Dometic; dal 22/10 anche frigo a compressore, batterie al litio e oscuranti
// Thermoglas, vedi titoli-shopping.md): il tipo di prodotto davanti se il nome non lo dice,
// e "per camper" in coda se non c'e' gia' camper/van/caravan. Solo il feed: il nome sul sito non cambia.
// Nessun dato inventato: il tipo e' generico ("Climatizzatore", "Riscaldatore a gasolio"), niente potenze o
// modalita' di montaggio nel titolo. I kit/bundle e il riscaldatore portatile restano come sono.
function addProductType(title: string, p: { name: string; is_bundle?: boolean | null; categories?: { name?: string } | null }): string {
  const category = (p.categories?.name || '').trim();
  if (p.is_bundle || !/^(Riscaldatori a Gasolio e Gas|Climatizzatori|Cucina|Batterie|Cabina Guida)$/.test(category)) return title;
  if (/portatile|^kit\b/i.test(p.name)) return title;
  // In Cucina solo i frigoriferi a compressore ExtraCOOL (FRG...): gli altri prodotti restano come sono.
  if (category === 'Cucina' && !/frg\d/i.test(p.name)) return title;

  let out = title;
  if (category === 'Climatizzatori' && !/climatizzator|condizionator/i.test(out)) {
    out = `Climatizzatore ${out}`;
  } else if (category === 'Riscaldatori a Gasolio e Gas' && !/riscaldator|stufa/i.test(out)) {
    out = `Riscaldatore a gasolio ${out}`;
  } else if (category === 'Cucina' && !/compressore/i.test(out)) {
    // Gli ExtraCOOL FRG sono tutti a compressore (descrizione della sottocategoria): "frigo compressore" e' la ricerca.
    out = out.replace(/^Frigorifero\s+/i, '');
    out = `Frigorifero a compressore ${out}`;
  } else if (category === 'Batterie' && !/litio|lifepo4/i.test(out)) {
    out = `Batteria al litio ${out.replace(/^Batteria\s+/i, '')}`;
  } else if (category === 'Cabina Guida' && /thermoglas/i.test(out) && !/oscurant/i.test(out)) {
    out = `Oscurante termico ${out}`;
  }
  // La Truma S 3004 e' venduta anche col nome Trumatic S 3004 (dato dalla scheda prodotto): e' come la cercano i clienti.
  if (/Truma S 3004/i.test(out) && !/trumatic/i.test(out)) out = `${out} (Trumatic S 3004)`;
  if (!/camper|\bvan\b|caravan|motorhome/i.test(out)) out = `${out} per camper`;
  return out;
}

// Spedizione gratuita: da 150 € per i colli normali, da 1.500 € per pallet e collo lungo.
// Stesse soglie di create-checkout-session, create-cod-order e js/main.js: se cambiano li', vanno cambiate qui.
const FREE_SHIPPING_THRESHOLD_CENTS = 150000;
const FREE_SHIPPING_NORMAL_THRESHOLD_CENTS = 15000;

// Come calculateShippingCents del checkout, per un solo pezzo. Per i pallet si usa la fascia "italia":
// la fascia isole (piu' cara) resta solo nel checkout, perche' il feed non distingue le regioni.
// null = fascia non trovata: niente g:shipping, Google usa le impostazioni dell'account.
function itemShippingCents(
  p: { price_cents: number; weight_kg: number | null; ships_on_pallet: boolean | null; long_package: boolean | null; shipping_included: boolean | null },
  bands: { package_type: string; zona: string; weight_min_kg: number | string; price_cents: number }[]
): number | null {
  if (p.shipping_included) return 0;
  if (p.price_cents >= FREE_SHIPPING_THRESHOLD_CENTS) return 0;
  const packageType = p.ships_on_pallet ? 'pallet' : p.long_package ? 'lungo' : 'normale';
  if (packageType === 'normale' && p.price_cents >= FREE_SHIPPING_NORMAL_THRESHOLD_CENTS) return 0;
  const zona = packageType === 'pallet' ? 'italia' : 'tutte';
  const weight = p.weight_kg != null ? Number(p.weight_kg) : 0.5; // stesso fallback del checkout
  const band = bands
    .filter((b) => b.package_type === packageType && b.zona === zona && Number(b.weight_min_kg) <= weight)
    .sort((a, b) => Number(b.weight_min_kg) - Number(a.weight_min_kg))[0];
  return band ? band.price_cents : null;
}

function absoluteUrl(path: string): string {
  return path.startsWith('http') ? path : `${SITE_URL}/${path.replace(/^\//, '')}`;
}

function escapeXml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max - 1) + '…' : value;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
