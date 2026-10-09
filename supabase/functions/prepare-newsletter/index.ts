// ============================================================
// Edge Function: prepare-newsletter
//
// Chiamata dal cron mensile. NON manda nulla agli iscritti: sceglie
// 4 prodotti reali in evidenza (a rotazione casuale), salva la scelta
// in newsletter_drafts e manda solo un'ANTEPRIMA a chi gestisce il sito
// (NOTIFY_EMAIL). L'invio vero agli iscritti parte solo dopo, con
// send-newsletter, quando arriva l'ok esplicito — mai in automatico.
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'CDA Sito <onboarding@resend.dev>';
const NOTIFY_EMAIL = Deno.env.get('NOTIFY_EMAIL') || 'talucci.maria@alice.it';

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

  const { data: featured } = await supabase
    .from('products')
    .select('id, name, price_cents, compare_at_price_cents, image_url')
    .eq('active', true)
    .eq('featured', true)
    .gt('price_cents', 0)
    .order('id');

  const products: Product[] = shuffle(featured || []).slice(0, 4);
  if (products.length === 0) {
    return new Response(JSON.stringify({ skipped: 'Nessun prodotto in evidenza disponibile' }), { status: 200 });
  }

  const { count: activeSubscribers } = await supabase
    .from('newsletter_signups')
    .select('id', { count: 'exact', head: true })
    .is('unsubscribed_at', null);

  const monthLabel = new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

  const { data: draft, error: draftError } = await supabase
    .from('newsletter_drafts')
    .insert({ product_ids: products.map((p) => p.id), month_label: monthLabel })
    .select('id')
    .single();

  if (draftError || !draft) {
    return new Response(JSON.stringify({ error: 'Errore salvataggio bozza: ' + draftError?.message }), { status: 500 });
  }

  if (RESEND_API_KEY) {
    const html = previewEmailHtml(products, monthLabel, activeSubscribers || 0, draft.id);
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: NOTIFY_EMAIL,
        subject: `Bozza newsletter da approvare — ${capitalize(monthLabel)}`,
        html,
      }),
    });
  }

  return new Response(JSON.stringify({ draftId: draft.id, products: products.length, activeSubscribers }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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

function previewEmailHtml(products: Product[], monthLabel: string, activeSubscribers: number, draftId: string): string {
  return `<!DOCTYPE html>
<html lang="it">
<body style="margin:0;padding:0;background:#F7F5F2;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F5F2;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #E4E1DB;">
        <tr><td style="background:#8a4a12;padding:16px 32px;">
          <p style="margin:0;color:#ffffff;font-size:13px;font-weight:bold;">
            📋 BOZZA — non ancora inviata a nessun iscritto (${activeSubscribers} iscritti attivi in attesa). Per inviarla davvero serve l'ok esplicito a Claude in chat.
          </p>
        </td></tr>
        <tr><td style="background:#1B1B1D;padding:24px 32px;">
          <span style="font-family:Arial,sans-serif;font-weight:800;font-size:20px;letter-spacing:.04em;color:#ffffff;">CDA</span>
          <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#C9CDD0;margin-top:4px;">Anteprima newsletter mensile</div>
        </td></tr>
        <tr><td style="padding:28px 32px 8px;">
          <p style="margin:0 0 6px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#D2131A;font-weight:bold;">${capitalize(monthLabel)}</p>
          <h1 style="margin:0 0 18px;font-size:20px;line-height:1.25;color:#1B1B1D;">Qualche prodotto da tenere d'occhio</h1>
          ${products.map(productCardHtml).join('')}
        </td></tr>
        <tr><td style="padding:16px 32px 28px;border-top:1px solid #E4E1DB;">
          <p style="margin:0;font-size:12.5px;color:#6E7276;">ID bozza: ${draftId}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
