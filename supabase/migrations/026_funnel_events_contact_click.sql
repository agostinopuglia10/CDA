-- Contatti dal sito misurabili: clic su telefono, WhatsApp ed email finiscono in funnel_events
-- come event_name = 'contact_click'. La colonna "detail" porta metodo e pagina (es. 'phone|/camper-usati').
-- Modifica solo additiva: le righe esistenti non cambiano.

alter table public.funnel_events add column if not exists detail text;

alter table public.funnel_events drop constraint if exists funnel_events_event_name_check;
alter table public.funnel_events add constraint funnel_events_event_name_check
  check (event_name = any (array['view_item', 'add_to_cart', 'begin_checkout', 'contact_click']));
