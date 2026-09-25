// ============================================================
// Edge Function: send-newsletter
//
// Manda agli iscritti attivi la bozza già approvata (product_ids salvati
// in newsletter_drafts da prepare-newsletter) — così quello che si invia
// è esattamente quello che è stato mostrato in anteprima, non una nuova
// selezione casuale.
//
// NON è collegata a nessun cron: va chiamata a mano solo dopo l'ok
// esplicito sulla bozza (richiede sempre il segreto in "x-cron-secret",
// stesso schema di backup-database, per evitare invii accidentali).
// Body richiesto: { "draft_id": "..." }
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'CDA Sito <onboarding@resend.dev>';

type Product = {
  id: string;
  name: string;
  price_cents: number;
  compare_at_price_cents: number | null;
  image_url: string | null;
};

Deno.serve(async (req: Request) => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const providedSecret = req.headers.get('x-cron-secret') || '';
  const { data: isValid, error: authError } = await supabase.rpc('verify_newsletter_cron_secret', {
    p_secret: providedSecret,
  });
  if (authError || !isValid) {
    return new Response(JSON.stringify({ error: 'Non autorizzato' }), { status: 401 });
  }

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY non configurato' }), { status: 500 });
  }

  const { draft_id } = await req.json().catch(() => ({ draft_id: null }));
  if (!draft_id) {
    return new Response(JSON.stringify({ error: 'draft_id mancante nel body' }), { status: 400 });
  }

  const { data: draft, error: draftError } = await supabase
    .from('newsletter_drafts')
    .select('id, product_ids, month_label, sent_at')
    .eq('id', draft_id)
    .single();

  if (draftError || !draft) {
    return new Response(JSON.stringify({ error: 'Bozza non trovata' }), { status: 404 });
  }
  if (draft.sent_at) {
    return new Response(JSON.stringify({ error: 'Questa bozza è già stata inviata il ' + draft.sent_at }), { status: 409 });
  }

  const { data: productsData } = await supabase
    .from('products')
    .select('id, name, price_cents, compare_at_price_cents, image_url')
    .in('id', draft.product_ids);

  // Riordina secondo l'ordine salvato nella bozza (approvata così com'era).
  const products: Product[] = (draft.product_ids as string[])
    .map((id) => (productsData || []).find((p) => p.id === id))
    .filter((p): p is Product => !!p);

  if (products.length === 0) {
    return new Response(JSON.stringify({ error: 'Nessuno dei prodotti della bozza è ancora disponibile' }), { status: 409 });
  }

  const { data: subscribers } = await supabase
    .from('newsletter_signups')
    .select('email, unsubscribe_token')
    .is('unsubscribed_at', null);

  if (!subscribers || subscribers.length === 0) {
    return new Response(JSON.stringify({ skipped: 'Nessun iscritto attivo' }), { status: 200 });
  }

  let sent = 0;
  let failed = 0;

  for (const sub of subscribers) {
    const unsubscribeUrl = `https://udynqqqxjcyhdeygqumi.supabase.co/functions/v1/newsletter-unsubscribe?token=${sub.unsubscribe_token}`;
    const html = newsletterHtml(products, draft.month_label, unsubscribeUrl);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: sub.email,
        subject: `Novità da CDA — ${capitalize(draft.month_label)}`,
        html,
      }),
    });

    if (res.ok) sent++; else failed++;
    await new Promise((r) => setTimeout(r, 150));
  }

  await supabase.from('newsletter_drafts').update({ sent_at: new Date().toISOString() }).eq('id', draft.id);

  return new Response(JSON.stringify({ sent, failed, products: products.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function escapeHtml(value: string | null | undefined): string {
  if (!value) return '';
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function productCardHtml(p: Product): string {
  const priceEUR = (p.price_cents / 100).toFixed(2).replace('.', ',');
  const hasDiscount = p.compare_at_price_cents && p.compare_at_price_cents > p.price_cents;
  const oldPriceEUR = hasDiscount ? (p.compare_at_price_cents! / 100).toFixed(2).replace('.', ',') : null;
  const img = p.image_url || 'https://cda-camper.it/images/og-cover.jpg';
  const url = `https://cda-camper.it/prodotto.html?id=${p.id}`;

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;border:1px solid #E4E1DB;">
      <tr>
        <td width="110" style="padding:12px;">
          <a href="${url}"><img src="${img}" alt="${escapeHtml(p.name)}" width="90" height="90" style="display:block;object-fit:cover;border:1px solid #E4E1DB;"></a>
        </td>
        <td style="padding:12px 16px 12px 0;">
          <a href="${url}" style="color:#1B1B1D;text-decoration:none;font-size:14.5px;font-weight:bold;line-height:1.3;">${escapeHtml(p.name)}</a>
          <div style="margin-top:6px;">
            ${oldPriceEUR ? `<span style="color:#6E7276;text-decoration:line-through;font-size:13px;margin-right:6px;">${oldPriceEUR} €</span>` : ''}
            <span style="color:#D2131A;font-weight:bold;font-size:15px;">${priceEUR} €</span>
          </div>
        </td>
      </tr>
    </table>`;
}

function newsletterHtml(products: Product[], monthLabel: string, unsubscribeUrl: string): string {
  return `<!DOCTYPE html>
<html lang="it">
<body style="margin:0;padding:0;background:#F7F5F2;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F5F2;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #E4E1DB;">
        <tr><td style="background:#1B1B1D;padding:28px 32px;">
          <span style="font-family:Arial,sans-serif;font-weight:800;font-size:22px;letter-spacing:.04em;color:#ffffff;">CDA</span>
          <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#C9CDD0;margin-top:4px;">Camper &amp; Lavorazioni · Tivoli</div>
        </td></tr>
        <tr><td style="padding:32px 32px 8px;">
          <p style="margin:0 0 6px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#D2131A;font-weight:bold;">${capitalize(monthLabel)}</p>
          <h1 style="margin:0 0 18px;font-size:22px;line-height:1.25;color:#1B1B1D;">Qualche prodotto da tenere d'occhio</h1>
          ${products.map(productCardHtml).join('')}
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 28px;">
            <tr><td style="background:#D2131A;">
              <a href="https://cda-camper.it/shop.html" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:bold;letter-spacing:.04em;text-transform:uppercase;color:#ffffff;text-decoration:none;">Vai allo shop →</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 32px 28px;border-top:1px solid #E4E1DB;">
          <p style="margin:0 0 6px;font-size:12.5px;color:#6E7276;">CDA di Talucci Maria · Via Arci 24, Tivoli (RM) · P.IVA 04047161007</p>
          <p style="margin:0;font-size:12.5px;color:#6E7276;"><a href="${unsubscribeUrl}" style="color:#6E7276;">Annulla iscrizione</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
