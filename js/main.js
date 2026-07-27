document.addEventListener('DOMContentLoaded', function () {
  initMobileMenu();
  initSearch();
  initCookieBanner();
  initContactForm();
  initCartPage();
  initCarousels();

  // initShopCatalog eventualmente sostituisce la griglia statica con
  // prodotti reali da Supabase: carrello/filtri/quantità vanno inizializzati
  // DOPO, così si agganciano sempre al DOM finale (dinamico o statico).
  Promise.resolve(initShopCatalog()).then(function () {
    initCart();
    initProductFilters();
    initQtySelector();
  });
});

function initShopCatalog() {
  var grid = document.querySelector('.product-grid');
  var filterBar = document.getElementById('filter-bar');
  if (!grid || !filterBar || !supabaseClient) return;

  return supabaseClient
    .from('products')
    .select('id, name, price_cents, image_url, featured, vehicle_compatibility, categories(slug, name)')
    .eq('active', true)
    .then(function (res) {
      if (res.error || !res.data || res.data.length === 0) return; // fallback silenzioso: restano i placeholder

      grid.innerHTML = '';
      res.data.forEach(function (p) {
        var catSlug = p.categories ? p.categories.slug : '';
        var catName = p.categories ? p.categories.name : '';
        var priceEUR = (p.price_cents / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        var badge = p.featured ? '<span class="product-badge">In evidenza</span>' : '';
        var thumb = p.image_url
          ? '<img src="' + p.image_url + '" alt="' + p.name + '" style="width:100%;height:100%;object-fit:cover;">'
          : 'Foto prodotto';

        var card = document.createElement('div');
        card.className = 'product-card';
        card.setAttribute('data-cat', catSlug);
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
    })
    .catch(function () { /* connessione assente o errore: restano i placeholder */ });
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
      '<p>Usiamo cookie tecnici necessari al funzionamento del sito e, solo con il tuo consenso, cookie di analisi statistica. Maggiori informazioni nella <a href="privacy.html">Privacy Policy</a>.</p>' +
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
  if (window.__gaLoaded) return;
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

// Invia un evento a GA4 solo se l'utente ha dato il consenso e Analytics è attivo
// (loadAnalytics imposta window.__gaLoaded). Se il consenso non c'è, non fa nulla.
function trackEvent(name, params) {
  if (!window.__gaLoaded || !window.dataLayer) return;
  window.dataLayer.push(['event', name, params || {}]);
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
      var matchesCat = currentCat === 'all' || card.getAttribute('data-cat') === currentCat;
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

  function renderCrossSell() {
    if (!crossSellEl) return;
    var currentIds = getCartItems().map(function (it) { return it.id; });
    var suggestions = CROSS_SELL_SUGGESTIONS.filter(function (s) { return currentIds.indexOf(s.id) === -1; });

    if (suggestions.length === 0) {
      crossSellEl.innerHTML = '';
      return;
    }

    var html = '<h3>Aggiungi anche</h3>';
    suggestions.forEach(function (s) {
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
        var suggestion = CROSS_SELL_SUGGESTIONS.filter(function (s) { return s.id === btn.getAttribute('data-suggestion-id'); })[0];
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
