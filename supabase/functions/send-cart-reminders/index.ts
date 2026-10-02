// ============================================================
// Edge Function: send-cart-reminders
//
// COSA FA (chiamata dal cron ogni ora, vedi job "send-cart-reminders-hourly"):
// Trova gli ordini "pending" con un'email vera lasciata dal cliente nel
// carrello, creati tra 1 e 48 ore fa, mai ancora ricontattati, e manda
// un promemoria gentile via Resend (nessuno sconto inventato, solo un
// richiamo a quello che avevano messo nel carrello). Segna reminder_sent_at
// per non mandarlo due volte. Non tocca mai ordini già pagati.
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'CDA Sito <onboarding@resend.dev>';
const SITE_URL = Deno.env.get('SITE_URL') || 'https://www.cda-camper.it';

Deno.serve(async (req: Request) => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const providedSecret = req.headers.get('x-cron-secret') || '';
  const { data: isValid, error: authError } = await supabase.rpc('verify_cart_reminder_cron_secret', {
    p_secret: providedSecret,
  });
  if (authError || !isValid) {
    return new Response(JSON.stringify({ error: 'Non autorizzato' }), { status: 401 });
  }

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ ok: true, sent: 0, note: 'RESEND_API_KEY non configurato' }));
  }

  const now = Date.now();
  const oldestEligible = new Date(now - 48 * 60 * 60 * 1000).toISOString();
  const newestEligible = new Date(now - 60 * 60 * 1000).toISOString();

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, customer_email, customer_name, total_cents, created_at')
    .eq('status', 'pending')
    .is('reminder_sent_at', null)
    .not('customer_email', 'is', null)
    .neq('customer_email', '')
    .gte('created_at', oldestEligible)
    .lte('created_at', newestEligible);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  if (!orders || orders.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0 }));
  }

  let sent = 0;
  for (const order of orders) {
    const { data: items } = await supabase
      .from('order_items')
      .select('quantity, products(name)')
      .eq('order_id', order.id);

    const itemsList = (items || [])
      .map((it: { quantity: number; products: { name: string } | null }) =>
        `<li>${it.quantity} × ${escapeHtml(it.products?.name || 'Articolo')}</li>`
      )
      .join('');

    const html = reminderEmailHtml(order.customer_name, itemsList);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: order.customer_email,
        subject: 'Hai lasciato qualcosa nel carrello — CDA',
        html,
      }),
    });

    if (res.ok) {
      await supabase.from('orders').update({ reminder_sent_at: new Date().toISOString() }).eq('id', order.id);
      sent++;
    }
  }

  return new Response(JSON.stringify({ ok: true, sent, found: orders.length }));

  function reminderEmailHtml(name: string | null, itemsList: string): string {
    const greeting = name ? `Ciao ${escapeHtml(name)},` : 'Ciao,';
    return `<!DOCTYPE html>
<html lang="it">
<body style="margin:0;padding:0;background:#F7F5F2;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F5F2;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #E4E1DB;">
        <tr><td align="center" style="background:#1B1B1D;padding:24px 32px 20px;">
          <img src="${SITE_URL}/images/logo-email.png" width="60" height="60" alt="CDA" style="display:block;width:60px;height:60px;border-radius:50%;margin:0 auto 10px;">
          <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#C9CDD0;">Camper &amp; Lavorazioni · Tivoli</div>
        </td></tr>
        <tr><td style="padding:36px 32px 8px;">
          <h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;color:#1B1B1D;">${greeting} hai lasciato qualcosa nel carrello.</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3a3a3d;">Nessuna fretta — è ancora tutto lì ad aspettarti:</p>
          <ul style="margin:0 0 24px;padding-left:20px;font-size:15px;line-height:1.8;color:#1B1B1D;">${itemsList}</ul>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
            <tr><td style="background:#D2131A;">
              <a href="${SITE_URL}/carrello.html" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:bold;letter-spacing:.04em;text-transform:uppercase;color:#ffffff;text-decoration:none;">Torna al carrello →</a>
            </td></tr>
          </table>
          <p style="margin:0 0 24px;font-size:13.5px;line-height:1.6;color:#6E7276;">Domande sul prodotto o sulla spedizione? Rispondi pure a questa email, oppure chiamaci al 348 990 5455.</p>
        </td></tr>
        <tr><td style="padding:20px 32px 28px;border-top:1px solid #E4E1DB;">
          <p style="margin:0;font-size:12.5px;color:#6E7276;">CDA di Talucci Maria · Strada Arci 24, Tivoli (RM) · P.IVA 04047161007</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }
});

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
