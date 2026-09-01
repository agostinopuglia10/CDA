document.addEventListener('DOMContentLoaded', function () {
  initMobileMenu();
  initSearch();
  initCookieBanner();
  initContactForm();
  initNewsletterForm();
  initCartPage();
  initCarousels();

  // initShopCatalog/initCategoryPage possono sostituire la griglia statica
  // con prodotti reali da Supabase: carrello/filtri/quantità vanno
  // inizializzati DOPO, così si agganciano sempre al DOM finale (dinamico o statico).
  Promise.all([
    Promise.resolve(initShopCatalog()),
    Promise.resolve(initCategoryPage()),
    Promise.resolve(initFeaturedCarousel()),
    Promise.resolve(initProductPage()),
    Promise.resolve(initTestimonials()),
    Promise.resolve(initDeliveryInfo())
  ]).then(function () {
    initCart();
    initProductFilters();
    initQtySelector();
  });
});

// Calcola il risparmio (in centesimi) di ogni kit rispetto alla somma dei
// componenti acquistati singolarmente. Usata per mostrare "Risparmi €X"
// sul badge dei kit in tutte le viste a lista/carosello (shop, categoria,
// in evidenza), non solo nella scheda prodotto.
function getBundleSavingsMap(bundleIds) {
  if (!bundleIds || bundleIds.length === 0 || !supabaseClient) return Promise.resolve({});
  return supabaseClient
    .from('bundle_items')
    .select('bundle_id, quantity, component:component_product_id(price_cents), bundle:bundle_id(price_cents)')
    .in('bundle_id', bundleIds)
    .then(function (res) {
      var totals = {};
      var bundlePrices = {};
      (res.data || []).forEach(function (row) {
        if (!row.component) return;
        var qty = row.quantity || 1;
        totals[row.bundle_id] = (totals[row.bundle_id] || 0) + row.component.price_cents * qty;
        if (row.bundle) bundlePrices[row.bundle_id] = row.bundle.price_cents;
      });
      var map = {};
      Object.keys(totals).forEach(function (id) {
        var savings = totals[id] - (bundlePrices[id] || 0);
        if (savings > 0) map[id] = savings;
      });
      return map;
    })
    .catch(function () { return {}; });
}

// Recensioni reali (tabella "testimonials" su Supabase). Il proprietario le
// aggiunge dal Table Editor di Supabase, senza toccare il codice: basta una
// riga con customer_name + review_text (active = true di default). Finché
// non ce n'è nessuna, la sezione resta nascosta invece di mostrare testi finti.
function initTestimonials() {
  var section = document.getElementById('testimonials-section');
  var grid = document.getElementById('testimonials-grid');
  if (!section || !grid || !supabaseClient) return;

  return supabaseClient
    .from('testimonials')
    .select('customer_name, review_text')
    .eq('active', true)
    .order('sort_order')
    .then(function (res) {
      if (res.error || !res.data || res.data.length === 0) return; // nessuna recensione vera ancora: sezione nascosta
      grid.innerHTML = '';
      res.data.forEach(function (t) {
        var card = document.createElement('div');
        card.className = 'cat-card';
        card.style.cursor = 'default';

        var quote = document.createElement('p');
        quote.style.fontStyle = 'italic';
        quote.style.marginBottom = '12px';
        quote.textContent = '"' + t.review_text + '"';

        var name = document.createElement('h3');
        name.style.fontSize = '16px';
        name.textContent = t.customer_name;

        card.appendChild(quote);
        card.appendChild(name);
        grid.appendChild(card);
      });
      section.style.display = '';
    })
    .catch(function () { /* connessione assente o errore: sezione nascosta */ });
}

// Tempo di consegna medio (tabella "site_settings", riga unica id=1, campo
// delivery_time_text). Il proprietario lo compila dal Table Editor di
// Supabase quando ha un dato reale — finché il campo è vuoto, niente badge
// né promessa sui tempi viene mostrata da nessuna parte del sito.
function initDeliveryInfo() {
  if (!supabaseClient) return;
  var tripItem = document.getElementById('trust-delivery-item');
  var tripText = document.getElementById('trust-delivery-text');
  var specRow = document.getElementById('spec-delivery-row');
  var specText = document.getElementById('spec-delivery');
  if (!tripItem && !specRow) return; // nessun punto di questa pagina lo mostra

  return supabaseClient
    .from('site_settings')
    .select('delivery_time_text')
    .eq('id', 1)
    .single()
    .then(function (res) {
      var text = res.data && res.data.delivery_time_text;
      if (res.error || !text) return; // tempo di consegna non ancora definito
      if (tripItem && tripText) { tripText.textContent = text; tripItem.style.display = ''; }
      if (specRow && specText) { specText.textContent = text; specRow.style.display = ''; }
    })
    .catch(function () { /* dato non ancora impostato */ });
}

function initShopCatalog() {
  var grid = document.querySelector('.product-grid');
  var filterBar = document.getElementById('filter-bar');
  if (!grid || !filterBar || !supabaseClient) return;

  return supabaseClient
    .from('products')
    .select('id, name, price_cents, image_url, featured, is_bundle, vehicle_compatibility, categories(slug, name, path)')
    .eq('active', true)
    .then(function (res) {
      if (res.error || !res.data || res.data.length === 0) return; // fallback silenzioso: restano i placeholder

      var bundleIds = res.data.filter(function (p) { return p.is_bundle; }).map(function (p) { return p.id; });
      return getBundleSavingsMap(bundleIds).then(function (savingsMap) {
      grid.innerHTML = '';
      res.data.forEach(function (p) {
        // Il pulsante filtro usa lo slug di primo livello (interni/esterni/...),
        // ma il prodotto è agganciato alla sottocategoria foglia: il primo
        // segmento di "path" è sempre il livello giusto per il filtro.
        var topSlug = p.categories && p.categories.path ? p.categories.path.split('.')[0] : (p.categories ? p.categories.slug : '');
        var catName = p.categories ? p.categories.name : '';
        var priceEUR = (p.price_cents / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        var badge = p.is_bundle
          ? '<span class="product-badge">' + (savingsMap[p.id] ? 'Risparmi ' + formatEUR(savingsMap[p.id]) : 'Kit risparmio') + '</span>'
          : (p.featured ? '<span class="product-badge">In evidenza</span>' : '');
        var thumb = p.image_url
          ? '<img src="' + p.image_url + '" alt="' + p.name + '" style="width:100%;height:100%;object-fit:cover;">'
          : 'Foto prodotto';

        var card = document.createElement('div');
        card.className = 'product-card';
        card.setAttribute('data-cat', topSlug);
        card.setAttribute('data-bundle', p.is_bundle ? 'true' : 'false');
        card.setAttribute('data-vehicle', p.vehicle_compatibility || 'universale');
        card.innerHTML =
          '<a class="product-link" href="prodotto.html?id=' + p.id + '">' +
            '<div class="product-thumb">' + badge + thumb + '</div>' +
          '</a>' +
          '<div class="product-body">' +
            '<span class="product-cat">' + catName + '</span>' +
            '<a class="product-link" href="prodotto.html?id=' + p.id + '"><h4>' + p.name + '</h4></a>' +
            '<div class="product-price"><strong>€ ' + priceEUR + '</strong>' +
              '<button class="add-btn" data-product-id="' + p.id + '" data-product-name="' + p.name + '" data-product-price="' + p.price_cents + '" aria-label="Aggiungi al carrello">+</button>' +
            '</div>' +
          '</div>';
        grid.appendChild(card);
      });
      });
    })
    .catch(function () { /* connessione assente o errore: restano i placeholder */ });
}

function initFeaturedCarousel() {
  var track = document.getElementById('featured-carousel');
  if (!track || !supabaseClient) return;

  return supabaseClient
    .from('products')
    .select('id, name, price_cents, image_url, featured, is_bundle, categories(slug, name)')
    .eq('active', true)
    .eq('featured', true)
    .then(function (res) {
      if (res.error || !res.data || res.data.length === 0) return; // fallback silenzioso: restano i placeholder

      var bundleIds = res.data.filter(function (p) { return p.is_bundle; }).map(function (p) { return p.id; });
      return getBundleSavingsMap(bundleIds).then(function (savingsMap) {
      track.innerHTML = '';
      res.data.forEach(function (p) {
        var catName = p.categories ? p.categories.name : '';
        var priceEUR = (p.price_cents / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        var badge = p.is_bundle
          ? '<span class="product-badge">' + (savingsMap[p.id] ? 'Risparmi ' + formatEUR(savingsMap[p.id]) : 'Kit risparmio') + '</span>'
          : '<span class="product-badge">In evidenza</span>';
        var thumb = p.image_url
          ? '<img src="' + p.image_url + '" alt="' + p.name + '" style="width:100%;height:100%;object-fit:cover;">'
          : 'Foto prodotto';

        var card = document.createElement('div');
        card.className = 'product-card promo-card';
        card.innerHTML =
          '<a class="product-link" href="prodotto.html?id=' + p.id + '">' +
            '<div class="product-thumb">' + badge + thumb + '</div>' +
          '</a>' +
          '<div class="product-body">' +
            '<span class="product-cat">' + catName + '</span>' +
            '<a class="product-link" href="prodotto.html?id=' + p.id + '"><h4>' + p.name + '</h4></a>' +
            '<div class="product-price"><strong>€ ' + priceEUR + '</strong>' +
              '<button class="add-btn" data-product-id="' + p.id + '" data-product-name="' + p.name + '" data-product-price="' + p.price_cents + '" aria-label="Aggiungi al carrello">+</button>' +
            '</div>' +
          '</div>';
        track.appendChild(card);
      });
      });
    })
    .catch(function () { /* connessione assente o errore: restano i placeholder */ });
}

// Struttura reale e definitiva del catalogo, come albero a profondità
// variabile: ogni nodo ha "children" opzionali. Un ramo può fermarsi a
// Categoria → Sottocategoria (2 livelli, il caso di oggi) oppure scendere
// a un 3° livello "Tipologia" quando servirà — senza cambiare né lo
// schema DB né questo codice, basta aggiungere "children" al nodo giusto.
// Vive qui (non solo su Supabase) così categoria.html mostra sempre i
// contenuti corretti anche prima/senza connessione DB: Supabase resta
// solo la fonte dei PRODOTTI reali (progressive enhancement).
var CATEGORIES_DATA = {
  interni: {
    name: 'Interni',
    description: "Vivi comodo, ovunque tu sia: arredamento, toilette, cucina e tutto l'occorrente per gli interni del tuo camper.",
    children: {
      arredamento: { name: 'Arredamento', img: 'images/sottocategorie/interni-arredamento.jpg' },
      toilette: { name: 'Toilette', img: 'images/sottocategorie/interni-toilette.jpg' },
      cucina: { name: 'Cucina', img: 'images/sottocategorie/interni-cucina.jpg' },
      garage: { name: 'Garage', img: 'images/sottocategorie/interni-garage.jpg' },
      oscuranti: { name: 'Oscuranti', img: 'images/sottocategorie/interni-oscuranti.jpg' },
      zanzariere: { name: 'Zanzariere', img: 'images/sottocategorie/interni-zanzariere.jpg' },
      aperture: { name: 'Aperture', img: 'images/sottocategorie/interni-aperture.jpg' },
      'cabina-guida': { name: 'Cabina Guida', img: 'images/sottocategorie/interni-cabina-guida.jpg' },
      utensili: { name: 'Utensili', img: 'images/sottocategorie/interni-utensili.jpg' }
    }
  },
  esterni: {
    name: 'Esterni',
    description: "Goditi l'aria aperta ovunque ti fermi: aperture, verande e portaggio per il tuo camper.",
    children: {
      aperture: { name: 'Aperture' },
      verande: { name: 'Verande', img: 'images/sottocategorie/esterni-verande.jpg' },
      portaggio: { name: 'Portaggio', img: 'images/sottocategorie/esterni-portaggio.jpg' },
      sicurezza: { name: 'Segnaletica e Sicurezza' }
    }
  },
  energia: {
    name: 'Energia',
    description: 'Autonomia senza pensieri: batterie, pannelli solari e strumentazioni per il tuo impianto elettrico.',
    children: {
      batterie: { name: 'Batterie', img: 'images/sottocategorie/energia-batterie.jpg' },
      'pannelli-solari': { name: 'Pannelli Solari', img: 'images/sottocategorie/energia-pannelli-solari.jpg' },
      strumentazioni: { name: 'Strumentazioni', img: 'images/sottocategorie/energia-strumentazioni.jpg' }
    }
  },
  acqua: {
    name: 'Acqua',
    description: 'Comfort domestico in viaggio: prodotti chimici, pompe, serbatoi e rubinetteria.',
    children: {
      'prodotti-chimici': { name: 'Prodotti Chimici', img: 'images/sottocategorie/acqua-prodotti-chimici.jpg' },
      pompe: { name: 'Pompe', img: 'images/sottocategorie/acqua-pompe.jpg' },
      serbatoi: { name: 'Serbatoi', img: 'images/sottocategorie/acqua-serbatoi.jpg' },
      rubinetteria: { name: 'Rubinetteria', img: 'images/sottocategorie/acqua-rubinetteria.jpg' }
    }
  },
  clima: {
    name: 'Clima',
    description: 'A tuo agio in ogni stagione: climatizzatori e riscaldatori a gasolio e gas.',
    children: {
      climatizzatori: { name: 'Climatizzatori', img: 'images/sottocategorie/clima-climatizzatori.jpg' },
      'riscaldatori-gasolio-gas': { name: 'Riscaldatori a Gasolio e Gas', img: 'images/sottocategorie/clima-riscaldatori-gasolio-gas.jpg' }
    }
  }
};

// Cammina l'albero seguendo un path punteggiato ("interni" oppure
// "interni.arredamento" oppure "interni.arredamento.sportelloni"...)
// e restituisce il nodo trovato più la catena di antenati per il breadcrumb.
function resolveCategoryPath(pathStr) {
  var segments = String(pathStr).split('.');
  var nodes = CATEGORIES_DATA;
  var node = null;
  var ancestors = [];
  for (var i = 0; i < segments.length; i++) {
    var seg = segments[i];
    if (!nodes || !nodes[seg]) return null;
    node = nodes[seg];
    ancestors.push({ slug: seg, name: node.name });
    nodes = node.children;
  }
  return { node: node, ancestors: ancestors };
}

function initCategoryPage() {
  var grid = document.getElementById('category-product-grid');
  var subcatGrid = document.getElementById('subcategory-grid');
  if (!grid || !subcatGrid) return;

  var params = new URLSearchParams(window.location.search);
  var pathStr = params.get('slug') || 'interni';

  applyCategoryData(pathStr, subcatGrid, grid);

  var loadPromise = Promise.resolve();
  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    loadPromise = loadCategoryFromSupabase(pathStr, subcatGrid, grid);
  }

  return loadPromise.then(function () {
    wireCategoryPageInteractions(grid, subcatGrid);
  });
}

function applyCategoryData(pathStr, subcatGrid, grid) {
  var resolved = resolveCategoryPath(pathStr);
  if (!resolved) return; // path sconosciuto: restano i placeholder statici
  var node = resolved.node;
  var ancestors = resolved.ancestors;

  var nameEl = document.getElementById('category-name');
  var descEl = document.getElementById('category-desc');
  var metaDesc = document.getElementById('meta-description');
  var breadcrumbEl = document.getElementById('breadcrumb');
  if (nameEl) nameEl.textContent = node.name;
  if (descEl) descEl.textContent = node.description || '';
  document.title = node.name + ' — Shop Camper | CDA Tivoli';
  if (metaDesc && node.description) metaDesc.setAttribute('content', node.description);

  if (breadcrumbEl) {
    var trailHtml = '<a href="index.html">Home</a> / <a href="shop.html">Shop Camper</a>';
    var acc = '';
    ancestors.forEach(function (a, i) {
      acc = acc ? acc + '.' + a.slug : a.slug;
      if (i < ancestors.length - 1) {
        trailHtml += ' / <a href="categoria.html?slug=' + acc + '">' + a.name + '</a>';
      } else {
        trailHtml += ' / <span id="breadcrumb-current">' + a.name + '</span>';
      }
    });
    breadcrumbEl.innerHTML = trailHtml;
  }

  var children = node.children || {};
  var childSlugs = Object.keys(children);

  subcatGrid.innerHTML = '';
  var allBtn = document.createElement('button');
  allBtn.className = 'cat-card active';
  allBtn.setAttribute('data-subcat', 'all');
  allBtn.setAttribute('style', 'cursor:pointer;width:100%;border:none;text-align:left;font-family:inherit;');
  allBtn.innerHTML = '<span class="cat-index">—</span><h3>Tutti i prodotti</h3>';
  subcatGrid.appendChild(allBtn);

  // Le sottocategorie "foglia" (senza children propri) restano filtri
  // in pagina, come oggi. Quelle che hanno a loro volta un 3° livello
  // diventano link che portano alla loro pagina — l'unica differenza
  // di comportamento è "ha children o no", il codice non sa in anticipo
  // quanto è profondo un ramo.
  childSlugs.forEach(function (slug, idx) {
    var child = children[slug];
    var hasChildren = child.children && Object.keys(child.children).length > 0;
    var photo = child.img ? '<img class="cat-photo" src="' + child.img + '" alt="' + child.name + '">' : '';
    var inner = photo + '<span class="cat-index">' + String(idx + 1).padStart(2, '0') + '</span><h3>' + child.name + '</h3>';
    var el = document.createElement(hasChildren ? 'a' : 'button');
    el.className = child.img ? 'cat-card has-photo' : 'cat-card';
    el.setAttribute('style', 'cursor:pointer;width:100%;border:none;text-align:left;font-family:inherit;');
    if (hasChildren) {
      el.setAttribute('href', 'categoria.html?slug=' + pathStr + '.' + slug);
    } else {
      el.setAttribute('data-subcat', slug);
    }
    el.innerHTML = inner;
    subcatGrid.appendChild(el);
  });

  // Prodotti segnaposto finché non arrivano quelli reali da Supabase:
  // usano le sottocategorie "foglia" vere così anche la demo è coerente.
  grid.innerHTML = '';
  var leafChildren = childSlugs
    .filter(function (slug) { return !(children[slug].children && Object.keys(children[slug].children).length); })
    .map(function (slug) { return { slug: slug, name: children[slug].name }; });
  if (leafChildren.length === 0) leafChildren = [{ slug: 'all', name: node.name }];
  for (var i = 0; i < 4; i++) {
    var sub = leafChildren[i % leafChildren.length];
    var card = document.createElement('div');
    card.className = 'product-card';
    card.setAttribute('data-subcat', sub.slug);
    card.setAttribute('data-vehicle', 'universale');
    card.innerHTML =
      '<a class="product-link" href="prodotto.html"><div class="product-thumb">Foto prodotto</div></a>' +
      '<div class="product-body">' +
        '<span class="product-cat">' + sub.name + '</span>' +
        '<a class="product-link" href="prodotto.html"><h4>Nome prodotto placeholder</h4></a>' +
        '<div class="product-price"><strong>€ 00,00</strong><button class="add-btn" aria-label="Aggiungi al carrello">+</button></div>' +
      '</div>';
    grid.appendChild(card);
  }
}

function loadCategoryFromSupabase(pathStr, subcatGrid, grid) {
  return supabaseClient
    .from('categories')
    .select('id, name, description')
    .eq('path', pathStr)
    .single()
    .then(function (catRes) {
      if (catRes.error || !catRes.data) return; // nodo non trovato su Supabase: restano i placeholder locali
      var category = catRes.data;

      var nameEl = document.getElementById('category-name');
      var descEl = document.getElementById('category-desc');
      var metaDesc = document.getElementById('meta-description');
      if (nameEl) nameEl.textContent = category.name;
      if (descEl && category.description) descEl.textContent = category.description;
      document.title = category.name + ' — Shop Camper | CDA Tivoli';
      if (metaDesc && category.description) metaDesc.setAttribute('content', category.description);

      // La struttura dell'albero (nomi, ordine, foto, profondità) resta
      // quella locale di CATEGORIES_DATA, già completa e corretta: qui
      // carichiamo solo i PRODOTTI reali, senza toccare subcatGrid.
      //
      // I prodotti reali sono agganciati alle sottocategorie foglia, non
      // al nodo di primo livello: per mostrarli tutti quando si visita
      // una categoria (es. "Interni"), bisogna includere anche i prodotti
      // di ogni discendente, non solo quelli agganciati esattamente a
      // questo nodo. "path" rende questo facile: qualsiasi discendente ha
      // un path che inizia con "<questo path>." (oltre al nodo stesso).
      return supabaseClient
        .from('categories')
        .select('id')
        .or('path.eq.' + pathStr + ',path.like.' + pathStr + '.%')
        .then(function (subtreeRes) {
          var categoryIds = (subtreeRes.data || []).map(function (c) { return c.id; });
          if (categoryIds.indexOf(category.id) === -1) categoryIds.push(category.id);

          return supabaseClient
            .from('products')
            .select('id, name, price_cents, image_url, featured, is_bundle, vehicle_compatibility, categories(slug, name)')
            .eq('active', true)
            .in('category_id', categoryIds)
            .then(function (prodRes) {
              if (prodRes.error || !prodRes.data || prodRes.data.length === 0) return; // nessun prodotto: restano i placeholder

              var bundleIds = prodRes.data.filter(function (p) { return p.is_bundle; }).map(function (p) { return p.id; });
              return getBundleSavingsMap(bundleIds).then(function (savingsMap) {
              grid.innerHTML = '';
              prodRes.data.forEach(function (p) {
                var subSlug = p.categories ? p.categories.slug : '';
                var subName = p.categories ? p.categories.name : '';
                var priceEUR = (p.price_cents / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                var badge = p.is_bundle
                  ? '<span class="product-badge">' + (savingsMap[p.id] ? 'Risparmi ' + formatEUR(savingsMap[p.id]) : 'Kit risparmio') + '</span>'
                  : (p.featured ? '<span class="product-badge">In evidenza</span>' : '');
                var thumb = p.image_url
                  ? '<img src="' + p.image_url + '" alt="' + p.name + '" style="width:100%;height:100%;object-fit:cover;">'
                  : 'Foto prodotto';

                var card = document.createElement('div');
                card.className = 'product-card';
                card.setAttribute('data-subcat', subSlug);
                card.setAttribute('data-bundle', p.is_bundle ? 'true' : 'false');
                card.setAttribute('data-vehicle', p.vehicle_compatibility || 'universale');
                card.innerHTML =
                  '<a class="product-link" href="prodotto.html?id=' + p.id + '">' +
                    '<div class="product-thumb">' + badge + thumb + '</div>' +
                  '</a>' +
                  '<div class="product-body">' +
                    '<span class="product-cat">' + subName + '</span>' +
                    '<a class="product-link" href="prodotto.html?id=' + p.id + '"><h4>' + p.name + '</h4></a>' +
                    '<div class="product-price"><strong>€ ' + priceEUR + '</strong>' +
                      '<button class="add-btn" data-product-id="' + p.id + '" data-product-name="' + p.name + '" data-product-price="' + p.price_cents + '" aria-label="Aggiungi al carrello">+</button>' +
                    '</div>' +
                  '</div>';
                grid.appendChild(card);
              });
              });
            });
        });
    })
    .catch(function () { /* connessione assente o errore: restano i placeholder */ });
}

// ============================================================
// Pagina prodotto (prodotto.html?id=...): carica il prodotto reale
// da Supabase. Senza id valido o senza connessione resta la scheda
// statica di esempio già nell'HTML.
// ============================================================
function initProductPage() {
  var nameEl = document.getElementById('product-name');
  if (!nameEl) return; // non siamo su prodotto.html

  var params = new URLSearchParams(window.location.search);
  var id = params.get('id');
  if (!id || typeof supabaseClient === 'undefined' || !supabaseClient) return;

  return supabaseClient
    .from('products')
    .select('id, name, description, price_cents, image_url, featured, is_bundle, stock, category_id, categories(name, slug, path)')
    .eq('id', id)
    .eq('active', true)
    .single()
    .then(function (res) {
      if (res.error || !res.data) return; // prodotto non trovato: resta la scheda statica
      renderProductPage(res.data);
      renderRelatedProducts(res.data);
      return wireProductPageKit(res.data);
    })
    .catch(function () { /* connessione assente o errore: resta la scheda statica */ });
}

function renderRelatedProducts(p) {
  var grid = document.getElementById('related-products-grid');
  var tagEl = document.getElementById('related-products-tag');
  var topSlug = p.categories && p.categories.path ? p.categories.path.split('.')[0] : '';
  if (!grid || !topSlug) return;
  if (tagEl && CATEGORIES_DATA[topSlug]) tagEl.textContent = CATEGORIES_DATA[topSlug].name;

  return supabaseClient
    .from('categories')
    .select('id')
    .or('path.eq.' + topSlug + ',path.like.' + topSlug + '.%')
    .then(function (subtreeRes) {
      var categoryIds = (subtreeRes.data || []).map(function (c) { return c.id; });
      if (categoryIds.length === 0) return;

      return supabaseClient
        .from('products')
        .select('id, name, price_cents, image_url, featured, is_bundle, categories(name)')
        .eq('active', true)
        .in('category_id', categoryIds)
        .neq('id', p.id)
        .limit(4)
        .then(function (res) {
          if (res.error || !res.data || res.data.length === 0) return; // restano i placeholder

          var bundleIds = res.data.filter(function (rp) { return rp.is_bundle; }).map(function (rp) { return rp.id; });
          return getBundleSavingsMap(bundleIds).then(function (savingsMap) {
          grid.innerHTML = '';
          res.data.forEach(function (rp) {
            var priceEUR = formatEUR(rp.price_cents);
            var badge = rp.is_bundle
              ? '<span class="product-badge">' + (savingsMap[rp.id] ? 'Risparmi ' + formatEUR(savingsMap[rp.id]) : 'Kit risparmio') + '</span>'
              : (rp.featured ? '<span class="product-badge">In evidenza</span>' : '');
            var thumb = rp.image_url
              ? '<img src="' + rp.image_url + '" alt="' + rp.name + '" style="width:100%;height:100%;object-fit:cover;">'
              : 'Foto prodotto';

            var card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML =
              '<a class="product-link" href="prodotto.html?id=' + rp.id + '">' +
                '<div class="product-thumb">' + badge + thumb + '</div>' +
              '</a>' +
              '<div class="product-body">' +
                '<span class="product-cat">' + (rp.categories ? rp.categories.name : '') + '</span>' +
                '<a class="product-link" href="prodotto.html?id=' + rp.id + '"><h4>' + rp.name + '</h4></a>' +
                '<div class="product-price"><strong>' + priceEUR + '</strong>' +
                  '<button class="add-btn" data-product-id="' + rp.id + '" data-product-name="' + rp.name + '" data-product-price="' + rp.price_cents + '" aria-label="Aggiungi al carrello">+</button>' +
                '</div>' +
              '</div>';
            grid.appendChild(card);
          });
          });
        });
    });
}

function renderProductPage(p) {
  var catName = p.categories ? p.categories.name : '';
  var topSlug = p.categories && p.categories.path ? p.categories.path.split('.')[0] : '';
  var topName = (topSlug && CATEGORIES_DATA[topSlug]) ? CATEGORIES_DATA[topSlug].name : catName;
  var priceEUR = formatEUR(p.price_cents);
  var descText = p.description || (p.name + ' disponibile nello Shop Camper CDA. Spedizione in tutta Italia o ritiro a Tivoli (RM), installazione disponibile nel centro tecnico.');

  document.title = p.name + ' | Shop CDA Tivoli';
  var metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', descText.slice(0, 300));

  var nameField = document.getElementById('product-name');
  var catEl = document.getElementById('product-cat');
  var priceEl = document.getElementById('product-price');
  var descEl = document.getElementById('product-desc');
  var badgeEl = document.getElementById('product-badge');
  var specCatEl = document.getElementById('spec-category');
  var specAvailabilityEl = document.getElementById('spec-availability');
  var addBtn = document.getElementById('product-add-btn');
  var breadcrumbCatEl = document.getElementById('product-breadcrumb-cat');
  var breadcrumbNameEl = document.getElementById('product-breadcrumb-name');
  var thumbEl = document.getElementById('product-thumb');
  var kitContentsEl = document.getElementById('kit-contents');

  if (nameField) nameField.textContent = p.name;
  if (catEl) catEl.textContent = (topName && catName && topName !== catName) ? (topName + ' · ' + catName) : catName;
  if (priceEl) priceEl.textContent = priceEUR;
  if (descEl) descEl.textContent = descText;
  if (specCatEl) specCatEl.textContent = catName;
  if (specAvailabilityEl) {
    // La maggior parte dei prodotti non è tenuta a magazzino: si spedisce
    // direttamente dal fornitore all'indirizzo del cliente. "stock" resta
    // pronto per quando (e se) alcuni articoli verranno tenuti in sede.
    specAvailabilityEl.textContent = (p.stock && p.stock > 0)
      ? 'Disponibile, spedizione immediata'
      : 'Su ordinazione, spedizione diretta';
  }
  if (breadcrumbNameEl) breadcrumbNameEl.textContent = p.name;
  if (breadcrumbCatEl && topSlug) {
    breadcrumbCatEl.textContent = topName;
    breadcrumbCatEl.setAttribute('href', 'categoria.html?slug=' + topSlug);
  }

  if (badgeEl) {
    if (p.is_bundle) { badgeEl.textContent = 'Kit risparmio'; badgeEl.style.display = ''; }
    else if (p.featured) { badgeEl.textContent = 'In evidenza'; badgeEl.style.display = ''; }
    else { badgeEl.style.display = 'none'; }
  }

  if (thumbEl && p.image_url) {
    thumbEl.innerHTML = '<img src="' + p.image_url + '" alt="' + p.name + '" style="width:100%;height:100%;object-fit:cover;">';
  }

  if (addBtn) {
    addBtn.setAttribute('data-product-id', p.id);
    addBtn.setAttribute('data-product-name', p.name);
    addBtn.setAttribute('data-product-price', p.price_cents);
    addBtn.textContent = p.is_bundle ? '🛒 Aggiungi il kit al carrello' : '🛒 Aggiungi al carrello';
  }

  // Il blocco "Cosa include questo kit" statico è demo: si mostra solo
  // se il prodotto reale è davvero un kit (wireProductPageKit lo popola).
  if (kitContentsEl && !p.is_bundle) kitContentsEl.style.display = 'none';
}

function wireProductPageKit(p) {
  if (p.is_bundle) {
    return supabaseClient
      .from('bundle_items')
      .select('quantity, component:component_product_id(id, name, price_cents)')
      .eq('bundle_id', p.id)
      .then(function (res) {
        var kitContentsEl = document.getElementById('kit-contents');
        var listEl = document.getElementById('kit-items-list');
        var savingsEl = document.getElementById('kit-savings');
        if (res.error || !res.data || res.data.length === 0) { if (kitContentsEl) kitContentsEl.style.display = 'none'; return; }
        if (kitContentsEl) kitContentsEl.style.display = '';

        var totalSingle = 0;
        var html = '';
        res.data.forEach(function (item) {
          var comp = item.component;
          if (!comp) return;
          var qty = item.quantity || 1;
          totalSingle += comp.price_cents * qty;
          var label = comp.name + (qty > 1 ? ' × ' + qty : '');
          html += '<li><span class="kit-item-name">' + label + '</span><span class="kit-item-price">' + formatEUR(comp.price_cents * qty) + '</span></li>';
        });
        if (listEl) listEl.innerHTML = html;

        var savings = totalSingle - p.price_cents;
        if (savingsEl) {
          savingsEl.innerHTML = savings > 0
            ? '<span>Valore se acquistati singolarmente: <strong class="kit-strike">' + formatEUR(totalSingle) + '</strong></span><span class="kit-save-badge">Risparmi ' + formatEUR(savings) + '</span>'
            : '';
        }
      });
  }

  // Prodotto singolo: verifica se fa parte di un kit esistente, per l'upsell.
  return supabaseClient
    .from('bundle_items')
    .select('bundle_id, bundle:bundle_id(id, name, price_cents, active, is_bundle)')
    .eq('component_product_id', p.id)
    .then(function (res) {
      if (res.error || !res.data || res.data.length === 0) return;
      var entry = res.data.filter(function (b) { return b.bundle && b.bundle.active; })[0];
      if (!entry) return;
      var bundle = entry.bundle;

      return supabaseClient
        .from('bundle_items')
        .select('quantity, component:component_product_id(price_cents)')
        .eq('bundle_id', bundle.id)
        .then(function (compRes) {
          if (compRes.error || !compRes.data) return;
          var totalSingle = compRes.data.reduce(function (sum, item) {
            return sum + (item.component ? item.component.price_cents * (item.quantity || 1) : 0);
          }, 0);
          var savings = totalSingle - bundle.price_cents;
          if (savings <= 0) return;

          var upsellEl = document.getElementById('kit-upsell');
          var textEl = document.getElementById('kit-upsell-text');
          var linkEl = document.getElementById('kit-upsell-link');
          if (upsellEl && textEl && linkEl) {
            textEl.textContent = 'Lo trovi anche nel kit "' + bundle.name + '" e risparmi ' + formatEUR(savings) + '.';
            linkEl.setAttribute('href', 'prodotto.html?id=' + bundle.id);
            upsellEl.style.display = '';
          }
        });
    });
}

function wireCategoryPageInteractions(grid, subcatGrid) {
  var vehicleSelect = document.getElementById('vehicle-select');
  var noResults = document.getElementById('no-results');
  var currentSubcat = 'all';
  var currentVehicle = 'all';

  function applyFilters() {
    var visibleCount = 0;
    grid.querySelectorAll('.product-card').forEach(function (card) {
      var subcat = card.getAttribute('data-subcat');
      var vehicle = card.getAttribute('data-vehicle') || 'universale';
      var matchesSubcat = currentSubcat === 'all' || subcat === currentSubcat;
      var matchesVehicle = currentVehicle === 'all' || vehicle === 'universale' || vehicle === currentVehicle;
      var show = matchesSubcat && matchesVehicle;
      card.style.display = show ? '' : 'none';
      if (show) visibleCount++;
    });
    if (noResults) noResults.classList.toggle('show', visibleCount === 0);
  }

  var subcatButtons = subcatGrid.querySelectorAll('[data-subcat]');
  subcatButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      subcatButtons.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentSubcat = btn.getAttribute('data-subcat');
      applyFilters();
      var prodottiSection = document.getElementById('prodotti');
      if (prodottiSection) prodottiSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  if (vehicleSelect) {
    vehicleSelect.addEventListener('change', function () {
      currentVehicle = vehicleSelect.value;
      applyFilters();
    });
  }

  applyFilters();
}

function initMobileMenu() {
  var header = document.querySelector('.site-header');
  var toggle = document.querySelector('.nav-toggle');
  if (!header || !toggle) return;

  toggle.addEventListener('click', function () {
    var isOpen = header.classList.toggle('menu-open');
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  document.querySelectorAll('.main-menu > li').forEach(function (li) {
    var link = li.querySelector(':scope > a');
    var dropdown = li.querySelector('.dropdown');
    if (!dropdown || !link) return;
    link.addEventListener('click', function (e) {
      if (window.matchMedia('(max-width: 960px)').matches && !li.classList.contains('open')) {
        e.preventDefault();
        document.querySelectorAll('.main-menu > li.open').forEach(function (other) {
          if (other !== li) other.classList.remove('open');
        });
        li.classList.add('open');
      }
    });
  });
}

function initSearch() {
  var toggle = document.querySelector('.search-toggle');
  var panel = document.querySelector('.search-panel');
  if (!toggle || !panel) return;

  toggle.addEventListener('click', function () {
    var isOpen = panel.classList.toggle('open');
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    if (isOpen) {
      var input = panel.querySelector('input[type="search"]');
      if (input) input.focus();
    }
  });

  var params = new URLSearchParams(window.location.search);
  var q = params.get('q');
  if (q) {
    var input = panel.querySelector('input[type="search"]');
    if (input) input.value = q;
    panel.classList.add('open');
  }
}

var CART_STORAGE_KEY = 'cda_cart_items';

function getCartItems() {
  try { return JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || []; }
  catch (e) { return []; }
}

function saveCartItems(items) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
}

function getProductInfoFromButton(btn) {
  var id = btn.getAttribute('data-product-id');
  var name = btn.getAttribute('data-product-name');
  var priceCents = parseInt(btn.getAttribute('data-product-price'), 10);

  if (!id) {
    // Prodotto placeholder statico (demo, non ancora collegato a Supabase):
    // ricava nome/prezzo dal DOM così il carrello resta coerente, ma non è un articolo acquistabile reale.
    var card = btn.closest('.product-card') || document;
    var nameEl = card.querySelector('h1, h4');
    var priceEl = card.querySelector('.product-price strong, .product-detail-price');
    name = nameEl ? nameEl.textContent.trim() : 'Prodotto';
    var priceText = priceEl ? priceEl.textContent.replace(/[^\d,]/g, '').replace(',', '.') : '0';
    priceCents = Math.round(parseFloat(priceText || '0') * 100);
    id = 'demo:' + name;
  }
  return { id: id, name: name, priceCents: priceCents || 0 };
}

function initCart() {
  function updateCartDisplay() {
    var count = getCartItems().reduce(function (sum, it) { return sum + it.quantity; }, 0);
    document.querySelectorAll('.btn-cart span').forEach(function (span) {
      span.textContent = '(' + count + ')';
    });
  }
  updateCartDisplay();

  document.querySelectorAll('.add-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var isLarge = btn.classList.contains('add-btn-lg');
      var qty = 1;
      if (isLarge) {
        var qtyInput = document.querySelector('.qty-input');
        if (qtyInput) qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
      }

      var info = getProductInfoFromButton(btn);
      var items = getCartItems();
      var existing = items.filter(function (it) { return it.id === info.id; })[0];
      if (existing) {
        existing.quantity += qty;
      } else {
        items.push({ id: info.id, name: info.name, price_cents: info.priceCents, quantity: qty });
      }
      saveCartItems(items);
      updateCartDisplay();

      trackEvent('add_to_cart', {
        currency: 'EUR',
        value: (info.priceCents * qty) / 100,
        items: [{ item_id: info.id, item_name: info.name, quantity: qty, price: info.priceCents / 100 }]
      });

      var original = btn.textContent;
      btn.textContent = isLarge ? '✓ Aggiunto al carrello' : '✓';
      btn.classList.add('added');
      setTimeout(function () {
        btn.textContent = original;
        btn.classList.remove('added');
      }, 1200);
    });
  });
}

function initCookieBanner() {
  var STORAGE_KEY = 'cda_cookie_consent';
  var stored = localStorage.getItem(STORAGE_KEY);

  if (stored) {
    try {
      if (JSON.parse(stored).status === 'all') loadAnalytics();
    } catch (e) {}
    return;
  }

  var banner = document.createElement('div');
  banner.className = 'cookie-banner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Consenso cookie');
  banner.innerHTML =
    '<div class="cookie-banner-inner">' +
      '<p>Usiamo cookie tecnici necessari al funzionamento del sito e, solo con il tuo consenso, cookie di analisi statistica e di marketing (per mostrarti annunci pertinenti su Facebook/Instagram). Maggiori informazioni nella <a href="privacy.html">Privacy Policy</a>.</p>' +
      '<div class="cookie-banner-actions">' +
        '<button type="button" class="btn btn-outline cookie-reject">Solo necessari</button>' +
        '<button type="button" class="btn btn-primary cookie-accept">Accetta tutti</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(banner);
  requestAnimationFrame(function () { banner.classList.add('show'); });

  function saveConsent(status) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ status: status, date: new Date().toISOString() }));
    banner.classList.remove('show');
    setTimeout(function () { banner.remove(); }, 300);
  }

  banner.querySelector('.cookie-accept').addEventListener('click', function () {
    saveConsent('all');
    loadAnalytics();
  });
  banner.querySelector('.cookie-reject').addEventListener('click', function () {
    saveConsent('necessary');
  });
}

function loadAnalytics() {
  var GA_MEASUREMENT_ID = 'G-H2W2W8FGY6';
  if (!window.__gaLoaded) {
    window.__gaLoaded = true;
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
    document.head.appendChild(script);
    window.dataLayer = window.dataLayer || [];
    function gtag(){ dataLayer.push(arguments); }
    gtag('js', new Date());
    gtag('config', GA_MEASUREMENT_ID);
  }

  var META_PIXEL_ID = '1274471299084547';
  if (!window.__metaLoaded) {
    window.__metaLoaded = true;
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', META_PIXEL_ID);
    fbq('track', 'PageView');
  }
}

// Nomi degli eventi standard di Meta corrispondenti ai nostri eventi GA4,
// così ogni chiamata a trackEvent() invia il dato a entrambi senza dover
// toccare i punti del codice dove viene chiamata.
var META_EVENT_MAP = {
  add_to_cart: 'AddToCart',
  begin_checkout: 'InitiateCheckout',
  purchase: 'Purchase',
  generate_lead: 'Lead',
  newsletter_signup: 'Subscribe'
};

// Invia un evento a GA4 e al Pixel Meta, solo se il consenso è stato dato
// (loadAnalytics imposta i due flag qui sotto). Se il consenso non c'è, non fa nulla.
function trackEvent(name, params) {
  params = params || {};

  if (window.__gaLoaded && window.dataLayer) {
    window.dataLayer.push(['event', name, params]);
  }

  if (window.__metaLoaded && typeof fbq === 'function') {
    var metaName = META_EVENT_MAP[name];
    if (metaName) {
      var metaParams = {};
      if (params.currency) metaParams.currency = params.currency;
      if (typeof params.value === 'number') metaParams.value = params.value;
      if (Array.isArray(params.items)) {
        metaParams.content_type = 'product';
        metaParams.content_ids = params.items.map(function (it) { return it.item_id; });
        metaParams.contents = params.items.map(function (it) { return { id: it.item_id, quantity: it.quantity }; });
      }
      fbq('track', metaName, metaParams);
    }
  }
}

function initContactForm() {
  var form = document.getElementById('quote-form');
  if (!form) return;

  var status = document.getElementById('form-status');
  var button = form.querySelector('button[type="submit"]');

  function showStatus(type, message) {
    status.textContent = message;
    status.className = 'form-status show ' + type;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    if (!supabaseClient) {
      showStatus('error', 'Il modulo non è ancora collegato: chiamaci al 389 547 2846 o scrivi a info@cda-camper.it nel frattempo.');
      return;
    }

    var payload = {
      name: form.nome.value.trim(),
      email: form.email.value.trim(),
      phone: form.telefono.value.trim(),
      request_type: form.motivo.value,
      message: form.messaggio.value.trim(),
      source_page: window.location.pathname.split('/').pop()
    };

    button.disabled = true;
    var originalText = button.textContent;
    button.textContent = 'Invio in corso...';
    status.className = 'form-status';

    supabaseClient.from('quote_requests').insert([payload]).then(function (result) {
      button.disabled = false;
      button.textContent = originalText;
      if (result.error) {
        showStatus('error', 'Si è verificato un errore, riprova o contattaci direttamente. (' + result.error.message + ')');
      } else {
        showStatus('success', 'Richiesta inviata! Ti risponderemo entro 24 ore.');
        trackEvent('generate_lead', { request_type: payload.request_type, source_page: payload.source_page });
        form.reset();
      }
    });
  });
}

function initNewsletterForm() {
  var form = document.getElementById('newsletter-form');
  if (!form) return;

  var status = document.getElementById('newsletter-status');
  var button = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    if (typeof supabaseClient === 'undefined' || !supabaseClient) {
      if (status) status.textContent = 'Modulo non ancora collegato: riprova più tardi.';
      return;
    }

    var email = form.email.value.trim();
    var originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Invio...';

    supabaseClient
      .from('newsletter_signups')
      .insert([{ email: email, source_page: window.location.pathname.split('/').pop() }])
      .then(function (result) {
        button.disabled = false;
        button.textContent = originalText;
        if (result.error) {
          if (status) status.textContent = result.error.code === '23505'
            ? 'Sei già iscritto con questa email.'
            : 'Si è verificato un errore, riprova.';
        } else {
          if (status) status.textContent = 'Iscrizione confermata, grazie!';
          trackEvent('newsletter_signup', { source_page: window.location.pathname.split('/').pop() });
          form.reset();
        }
      });
  });
}

function initQtySelector() {
  document.querySelectorAll('.qty-selector').forEach(function (selector) {
    var input = selector.querySelector('.qty-input');
    var minus = selector.querySelector('.qty-minus');
    var plus = selector.querySelector('.qty-plus');
    if (!input) return;

    function setValue(v) {
      input.value = Math.max(1, v);
    }
    if (minus) minus.addEventListener('click', function () {
      setValue((parseInt(input.value, 10) || 1) - 1);
    });
    if (plus) plus.addEventListener('click', function () {
      setValue((parseInt(input.value, 10) || 1) + 1);
    });
    input.addEventListener('change', function () {
      setValue(parseInt(input.value, 10) || 1);
    });
  });
}

function initProductFilters() {
  var grid = document.querySelector('.product-grid');
  var filterBar = document.querySelector('.filter-bar');
  var searchPanel = document.querySelector('.search-panel');
  var noResults = document.getElementById('no-results');
  if (!grid) return;

  if (!filterBar) return;

  var vehicleSelect = document.getElementById('vehicle-select');
  var cards = Array.prototype.slice.call(grid.querySelectorAll('.product-card'));
  var currentCat = 'all';
  var currentQuery = '';
  var currentVehicle = 'all';

  function applyFilters() {
    var visibleCount = 0;
    cards.forEach(function (card) {
      var matchesCat = currentCat === 'all' || card.getAttribute('data-cat') === currentCat
        || (currentCat === 'kit' && card.getAttribute('data-bundle') === 'true');
      var vehicle = card.getAttribute('data-vehicle') || 'universale';
      var matchesVehicle = currentVehicle === 'all' || vehicle === 'universale' || vehicle === currentVehicle;
      var text = card.textContent.toLowerCase();
      var matchesQuery = !currentQuery || text.indexOf(currentQuery) !== -1;
      var show = matchesCat && matchesVehicle && matchesQuery;
      card.style.display = show ? '' : 'none';
      if (show) visibleCount++;
    });
    if (noResults) noResults.classList.toggle('show', visibleCount === 0);
  }

  if (vehicleSelect) {
    vehicleSelect.addEventListener('change', function () {
      currentVehicle = vehicleSelect.value;
      applyFilters();
    });
  }

  if (filterBar) {
    var buttons = filterBar.querySelectorAll('button');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        buttons.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        currentCat = btn.getAttribute('data-cat') || 'all';
        applyFilters();
      });
    });

    // Permette di arrivare già filtrato sui kit da un link esterno
    // (es. banner homepage "Scopri i kit"): shop.html?filter=kit
    var urlFilter = new URLSearchParams(window.location.search).get('filter');
    if (urlFilter) {
      var matchBtn = filterBar.querySelector('button[data-cat="' + urlFilter + '"]');
      if (matchBtn) {
        buttons.forEach(function (b) { b.classList.remove('active'); });
        matchBtn.classList.add('active');
        currentCat = urlFilter;
      }
    }
  }

  if (searchPanel) {
    var input = searchPanel.querySelector('input[type="search"]');
    if (input) {
      searchPanel.querySelector('form').addEventListener('submit', function (e) {
        e.preventDefault();
      });
      input.addEventListener('input', function () {
        currentQuery = input.value.trim().toLowerCase();
        applyFilters();
      });
      if (input.value) {
        currentQuery = input.value.trim().toLowerCase();
      }
    }
  }

  applyFilters();
}

function formatEUR(cents) {
  return '€ ' + (cents / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

var FREE_SHIPPING_THRESHOLD_CENTS = 5000; // € 50,00 — soglia placeholder, da confermare

var CROSS_SELL_SUGGESTIONS = [
  { id: 'demo:cross-1', name: 'Prolunga cavo solare 5m', price_cents: 1490 },
  { id: 'demo:cross-2', name: 'Portafusibili impermeabile', price_cents: 890 },
  { id: 'demo:cross-3', name: 'Monitor di carica batteria', price_cents: 3490 }
];

function initCartPage() {
  var emptyEl = document.getElementById('cart-empty');
  var contentEl = document.getElementById('cart-content');
  var listEl = document.getElementById('cart-list');
  var subtotalEl = document.getElementById('cart-subtotal');
  var totalEl = document.getElementById('cart-total');
  var shippingEl = document.getElementById('cart-shipping');
  var shippingProgressEl = document.getElementById('shipping-progress');
  var crossSellEl = document.getElementById('cross-sell');
  var checkoutBtn = document.getElementById('checkout-btn');
  var statusEl = document.getElementById('checkout-status');
  if (!emptyEl || !contentEl) return;

  function updateCartBadge() {
    var count = getCartItems().reduce(function (sum, it) { return sum + it.quantity; }, 0);
    document.querySelectorAll('.btn-cart span').forEach(function (span) { span.textContent = '(' + count + ')'; });
  }

  function updateQty(id, qty) {
    var items = getCartItems();
    var item = items.filter(function (it) { return it.id === id; })[0];
    if (!item) return;
    if (qty <= 0) {
      items = items.filter(function (it) { return it.id !== id; });
    } else {
      item.quantity = qty;
    }
    saveCartItems(items);
    updateCartBadge();
    render();
  }

  function removeItem(id) {
    saveCartItems(getCartItems().filter(function (it) { return it.id !== id; }));
    updateCartBadge();
    render();
  }

  function renderShippingProgress(subtotal) {
    if (!shippingProgressEl) return;
    var remaining = FREE_SHIPPING_THRESHOLD_CENTS - subtotal;
    var pct = Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD_CENTS) * 100));

    if (remaining <= 0) {
      shippingProgressEl.className = 'shipping-progress reached';
      shippingProgressEl.innerHTML =
        '<div class="shipping-progress-label">🎉 <strong>Hai la spedizione gratuita!</strong></div>' +
        '<div class="shipping-progress-bar"><div class="shipping-progress-bar-fill" style="width:100%"></div></div>';
      if (shippingEl) shippingEl.textContent = 'Gratuita';
    } else {
      shippingProgressEl.className = 'shipping-progress';
      shippingProgressEl.innerHTML =
        '<div class="shipping-progress-label">Ti mancano <strong>' + formatEUR(remaining) + '</strong> alla spedizione gratuita</div>' +
        '<div class="shipping-progress-bar"><div class="shipping-progress-bar-fill" style="width:' + pct + '%"></div></div>';
      if (shippingEl) shippingEl.textContent = 'Calcolata al passo successivo';
    }
  }

  var lastCrossSellSuggestions = CROSS_SELL_SUGGESTIONS;

  function paintCrossSell(suggestions, currentIds) {
    lastCrossSellSuggestions = suggestions;
    var filtered = suggestions.filter(function (s) { return currentIds.indexOf(s.id) === -1; });
    if (filtered.length === 0) {
      crossSellEl.innerHTML = '';
      return;
    }

    var html = '<h3>Aggiungi anche</h3>';
    filtered.forEach(function (s) {
      html +=
        '<div class="cross-sell-item">' +
          '<div class="cross-sell-thumb">Foto</div>' +
          '<div class="cross-sell-name">' + s.name + '</div>' +
          '<div class="cross-sell-price">' + formatEUR(s.price_cents) + '</div>' +
          '<button type="button" class="cross-sell-add" data-suggestion-id="' + s.id + '" aria-label="Aggiungi ' + s.name + '">+</button>' +
        '</div>';
    });
    crossSellEl.innerHTML = html;

    crossSellEl.querySelectorAll('.cross-sell-add').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var suggestion = lastCrossSellSuggestions.filter(function (s) { return s.id === btn.getAttribute('data-suggestion-id'); })[0];
        if (!suggestion) return;
        var items = getCartItems();
        var existing = items.filter(function (it) { return it.id === suggestion.id; })[0];
        if (existing) { existing.quantity += 1; } else { items.push({ id: suggestion.id, name: suggestion.name, price_cents: suggestion.price_cents, quantity: 1 }); }
        saveCartItems(items);
        updateCartBadge();
        render();
      });
    });
  }

  function renderCrossSell() {
    if (!crossSellEl) return;
    var currentIds = getCartItems().map(function (it) { return it.id; });
    var realIds = currentIds.filter(function (id) { return id.indexOf('demo:') !== 0; });

    // Se in carrello c'è un pezzo che fa parte di un kit, suggerisce gli
    // altri componenti dello stesso kit (upsell mirato) invece dei
    // suggerimenti generici — solo per prodotti reali collegati a Supabase.
    if (realIds.length === 0 || typeof supabaseClient === 'undefined' || !supabaseClient) {
      paintCrossSell(CROSS_SELL_SUGGESTIONS, currentIds);
      return;
    }

    supabaseClient
      .from('bundle_items')
      .select('bundle_id')
      .in('component_product_id', realIds)
      .then(function (res) {
        if (res.error || !res.data || res.data.length === 0) { paintCrossSell(CROSS_SELL_SUGGESTIONS, currentIds); return; }
        var bundleIds = res.data
          .map(function (r) { return r.bundle_id; })
          .filter(function (v, i, arr) { return arr.indexOf(v) === i; });

        return supabaseClient
          .from('bundle_items')
          .select('bundle_id, component:component_product_id(id, name, price_cents)')
          .in('bundle_id', bundleIds)
          .then(function (compRes) {
            if (compRes.error || !compRes.data) { paintCrossSell(CROSS_SELL_SUGGESTIONS, currentIds); return; }
            var seen = {};
            var suggestions = [];
            compRes.data.forEach(function (row) {
              var c = row.component;
              if (!c || realIds.indexOf(c.id) !== -1 || seen[c.id]) return;
              seen[c.id] = true;
              suggestions.push({ id: c.id, name: c.name, price_cents: c.price_cents });
            });
            paintCrossSell(suggestions.length > 0 ? suggestions : CROSS_SELL_SUGGESTIONS, currentIds);
          });
      })
      .catch(function () { paintCrossSell(CROSS_SELL_SUGGESTIONS, currentIds); });
  }

  function render() {
    var items = getCartItems();
    if (items.length === 0) {
      emptyEl.style.display = '';
      contentEl.style.display = 'none';
      return;
    }
    emptyEl.style.display = 'none';
    contentEl.style.display = 'block';

    listEl.innerHTML = '';
    var subtotal = 0;
    items.forEach(function (item) {
      subtotal += item.price_cents * item.quantity;

      var row = document.createElement('div');
      row.className = 'cart-row';
      row.innerHTML =
        '<div class="cart-thumb">Foto</div>' +
        '<div>' +
          '<div class="cart-name">' + item.name + '</div>' +
          '<div class="cart-unit-price">' + formatEUR(item.price_cents) + ' cad.</div>' +
          '<div class="qty-selector" style="height:38px;margin-top:8px;">' +
            '<button type="button" class="qty-minus" aria-label="Diminuisci quantità">−</button>' +
            '<input type="number" class="qty-input" value="' + item.quantity + '" min="1" aria-label="Quantità">' +
            '<button type="button" class="qty-plus" aria-label="Aumenta quantità">+</button>' +
          '</div>' +
          '<button type="button" class="cart-remove">Rimuovi</button>' +
        '</div>' +
        '<div class="cart-line-total">' + formatEUR(item.price_cents * item.quantity) + '</div>';

      row.querySelector('.qty-minus').addEventListener('click', function () { updateQty(item.id, item.quantity - 1); });
      row.querySelector('.qty-plus').addEventListener('click', function () { updateQty(item.id, item.quantity + 1); });
      row.querySelector('.qty-input').addEventListener('change', function (e) { updateQty(item.id, parseInt(e.target.value, 10) || 1); });
      row.querySelector('.cart-remove').addEventListener('click', function () { removeItem(item.id); });

      listEl.appendChild(row);
    });

    subtotalEl.textContent = formatEUR(subtotal);
    totalEl.textContent = formatEUR(subtotal);
    renderShippingProgress(subtotal);
    renderCrossSell();
  }

  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', function () {
      var items = getCartItems();
      var realItems = items.filter(function (it) { return it.id.indexOf('demo:') !== 0; });

      statusEl.className = 'form-status';

      if (realItems.length === 0) {
        statusEl.className = 'form-status show error';
        statusEl.textContent = 'Il pagamento online non è ancora attivo. Chiamaci al 389 547 2846 o scrivi a info@cda-camper.it per completare l\'ordine.';
        return;
      }
      if (typeof supabaseClient === 'undefined' || !supabaseClient) {
        statusEl.className = 'form-status show error';
        statusEl.textContent = 'Il pagamento online non è ancora collegato. Contattaci per completare l\'ordine.';
        return;
      }

      trackEvent('begin_checkout', {
        currency: 'EUR',
        value: realItems.reduce(function (sum, it) { return sum + (it.price_cents * it.quantity) / 100; }, 0),
        items: realItems.map(function (it) { return { item_id: it.id, item_name: it.name, quantity: it.quantity, price: it.price_cents / 100 }; })
      });

      checkoutBtn.disabled = true;
      var originalText = checkoutBtn.textContent;
      checkoutBtn.textContent = 'Attendere...';

      fetch(SUPABASE_URL + '/functions/v1/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
        body: JSON.stringify({
          items: realItems.map(function (it) { return { product_id: it.id, quantity: it.quantity }; })
        })
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.checkout_url) {
            window.location.href = data.checkout_url;
          } else {
            throw new Error(data.error || 'Errore sconosciuto');
          }
        })
        .catch(function (err) {
          checkoutBtn.disabled = false;
          checkoutBtn.textContent = originalText;
          statusEl.className = 'form-status show error';
          statusEl.textContent = 'Il pagamento online non è ancora attivo (' + err.message + '). Chiamaci al 389 547 2846 per completare l\'ordine.';
        });
    });
  }

  render();
}

function initCarousels() {
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var AUTO_SCROLL_SPEED = 22; // px al secondo — lento e discreto

  document.querySelectorAll('.scroll-carousel-wrap').forEach(function (wrap) {
    var track = wrap.querySelector('.scroll-carousel');
    var prev = wrap.querySelector('.scroll-arrow.prev');
    var next = wrap.querySelector('.scroll-arrow.next');
    if (!track) return;

    function scrollByAmount(dir) {
      var card = track.querySelector(':scope > *');
      var step = card ? card.getBoundingClientRect().width + 20 : 240;
      track.scrollBy({ left: dir * step * 2, behavior: 'smooth' });
    }

    if (prev) prev.addEventListener('click', function () { scrollByAmount(-1); });
    if (next) next.addEventListener('click', function () { scrollByAmount(1); });

    if (reduceMotion) return; // rispetta la preferenza di sistema "riduci le animazioni"

    var direction = 1;
    var paused = false;
    var lastTime = null;

    function tick(timestamp) {
      if (lastTime === null) lastTime = timestamp;
      var delta = (timestamp - lastTime) / 1000;
      lastTime = timestamp;

      if (paused) {
        track.classList.remove('no-snap');
      } else {
        var maxScroll = track.scrollWidth - track.clientWidth;
        if (maxScroll > 1) {
          track.classList.add('no-snap');
          track.scrollLeft += direction * AUTO_SCROLL_SPEED * delta;
          if (direction === 1 && track.scrollLeft >= maxScroll - 1) { track.scrollLeft = maxScroll; direction = -1; }
          else if (direction === -1 && track.scrollLeft <= 1) { track.scrollLeft = 0; direction = 1; }
        }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    // L'utente ha sempre il controllo: passare col mouse, toccare o navigare
    // da tastiera mette in pausa lo scorrimento automatico.
    function pause() { paused = true; }
    function resume() { paused = false; lastTime = null; }

    wrap.addEventListener('mouseenter', pause);
    wrap.addEventListener('mouseleave', resume);
    wrap.addEventListener('touchstart', pause, { passive: true });
    wrap.addEventListener('touchend', function () { setTimeout(resume, 3000); });
    wrap.addEventListener('focusin', pause);
    wrap.addEventListener('focusout', resume);
  });
}
