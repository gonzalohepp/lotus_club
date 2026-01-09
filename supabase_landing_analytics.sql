-- COPIA Y PEGA ESTO EN EL SQL EDITOR DE SUPABASE

create table if not exists landing_events (
  id uuid default gen_random_uuid() primary key,
  event_type text not null, -- 'visit', 'click_whatsapp', 'click_instagram', 'click_maps', 'click_access'
  created_at timestamptz default now(),
  metadata jsonb
);

-- Habilitar RLS
alter table landing_events enable row level security;

-- Permitir que CUALQUIERA (incluso anónimos) inserte eventos
-- Esto es necesario para que la landing page pública pueda registrar visitas
create policy "Enable insert for analytics" 
on landing_events 
for insert 
with check (true);

-- Permitir lectura solo a administradores/autenticados
-- Esto protege los datos para que solo se vean desde el dashboard
create policy "Enable read for authenticated users only" 
on landing_events 
for select 
using (auth.role() = 'authenticated');

-- Indexes para mejorar performance de consultas por fecha y tipo
create index idx_landing_events_created_at on landing_events(created_at);
create index idx_landing_events_type on landing_events(event_type);
