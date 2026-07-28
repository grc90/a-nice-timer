-- ============================================================================
--  A Nice Timer — esquema
--
--  Ejecutar entero en el SQL Editor de Supabase. Es idempotente: se puede volver
--  a correr sin romper nada.
--
--  Dos decisiones que gobiernan toda la sincronización:
--
--  1. TOMBSTONES en vez de DELETE físico. Borrar una fila no la saca de la
--     tabla, le pone `deleted_at`. Sin esto, borrar un preset en la compu y
--     abrir el celular después lo resucitaría: el celular no tiene forma de
--     distinguir "esto se borró" de "esto todavía no llegó".
--
--  2. focus_records es la TABLA DE HECHOS y los totales diarios se calculan con
--     SQL, no se guardan. Sumar dos rollups de dos dispositivos duplicaría el
--     tiempo en cada sincronización, y restarlos bien exige saber qué parte ya
--     se contó. Con los registros crudos del lado del servidor el agregado es
--     una consulta y siempre da exacto. Era el argumento para elegir Postgres
--     sobre Firestore; acá se cobra.
-- ============================================================================

-- ── presets ─────────────────────────────────────────────────────────────────

create table if not exists public.presets (
  id           uuid primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  name         text not null,
  mode         text not null check (mode in ('simple', 'pomodoro', 'freeFocus')),
  duration_ms  bigint not null,
  pomodoro     jsonb not null,
  skin_id      text not null,
  alarm_id     text not null,
  accent_color text,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index if not exists presets_user_idx on public.presets (user_id, deleted_at);

-- ── ajustes ─────────────────────────────────────────────────────────────────
-- Una fila por usuario con todo en un jsonb: son preferencias que siempre se
-- leen y escriben juntas, nunca se filtran por campo. Normalizarlas en columnas
-- obligaría a migrar el esquema cada vez que se agrega una opción.

create table if not exists public.user_settings (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ── metas ───────────────────────────────────────────────────────────────────

create table if not exists public.goals (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  daily_focus_ms  bigint not null default 0,
  weekly_focus_ms bigint not null default 0,
  updated_at      timestamptz not null default now()
);

-- ── registros de foco ───────────────────────────────────────────────────────
-- Append-only: nunca se actualizan ni se borran. Por eso sincronizar es una
-- unión por id y no puede haber conflicto entre dispositivos.

create table if not exists public.focus_records (
  id                 uuid primary key,
  user_id            uuid not null references auth.users (id) on delete cascade,
  day                date not null,
  ended_at           timestamptz not null,
  focused_ms         integer not null check (focused_ms >= 0),
  mode               text not null,
  -- Sin foreign key a propósito: si el preset se borra, el tiempo trabajado
  -- sigue siendo cierto y el registro tiene que sobrevivir con su nombre.
  preset_id          uuid,
  preset_name        text not null,
  completed_pomodoro boolean not null default false,
  partial            boolean not null default false
);

create index if not exists focus_records_user_day_idx on public.focus_records (user_id, day);

-- ── links de audio ──────────────────────────────────────────────────────────

create table if not exists public.audio_links (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  url         text not null,
  title       text not null,
  video_id    text,
  playlist_id text,
  kind        text not null check (kind in ('favorite', 'recent')),
  played_at   timestamptz,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists audio_links_user_idx on public.audio_links (user_id, kind, deleted_at);

-- ── Row Level Security ──────────────────────────────────────────────────────
-- Esto es lo que realmente protege los datos. La clave publishable es pública y
-- viaja en el bundle; sin estas políticas cualquiera podría leer todo.

alter table public.presets        enable row level security;
alter table public.user_settings  enable row level security;
alter table public.goals          enable row level security;
alter table public.focus_records  enable row level security;
alter table public.audio_links    enable row level security;

do $$
declare
  t text;
begin
  for t in
    select unnest(array['presets', 'user_settings', 'goals', 'focus_records', 'audio_links'])
  loop
    execute format('drop policy if exists %I on public.%I', t || '_owner', t);
    -- `with check` además de `using`: sin él un usuario podría insertar filas
    -- con el user_id de otro, aunque después no pudiera leerlas.
    -- `(select auth.uid())` y no `auth.uid()` pelado: envuelto en subconsulta
    -- Postgres lo evalúa una vez por query en lugar de una vez por fila.
    execute format(
      'create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_owner', t
    );
  end loop;
end $$;

-- ── updated_at automático ───────────────────────────────────────────────────
-- En el servidor y no en el cliente: el reloj del navegador puede estar
-- desfasado, y con resolución por última escritura eso decidiría mal los
-- conflictos entre dispositivos.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare
  t text;
begin
  for t in select unnest(array['presets', 'user_settings', 'goals'])
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',
      t || '_touch', t
    );
  end loop;
end $$;

-- ── Agregados de estadísticas ───────────────────────────────────────────────
-- El motivo por el que este proyecto usa Postgres. En un almacén de documentos
-- esto serían contadores desnormalizados que hay que mantener a mano en cada
-- escritura, y rellenar a mano cada vez que se quiere un corte nuevo.

create or replace function public.daily_focus_totals(since date)
returns table (
  day        date,
  focused_ms bigint,
  pomodoros  bigint,
  blocks     bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    fr.day,
    sum(fr.focused_ms)::bigint,
    count(*) filter (where fr.completed_pomodoro)::bigint,
    count(*)::bigint
  from public.focus_records fr
  where fr.user_id = (select auth.uid())
    and fr.day >= since
  group by fr.day
  order by fr.day;
$$;

-- Postgres otorga EXECUTE a PUBLIC en toda función nueva, y PUBLIC incluye a
-- `anon`. Sin el revoke, un `grant ... to authenticated` no restringe nada: sólo
-- agrega un permiso que ya estaba. Acá no hay fuga —la función es
-- `security invoker`, así que RLS la filtra y para `anon` auth.uid() es NULL—
-- pero dejarla invocable la volvería peligrosa el día que alguien la pase a
-- `security definer` sin recordar este detalle.
revoke execute on function public.daily_focus_totals(date) from public;
grant execute on function public.daily_focus_totals(date) to authenticated;

-- ── Salas compartidas (body doubling) ───────────────────────────────────────
--
-- Un invitado con el link tiene que ver el timer corriendo SIN cuenta. Eso pide
-- una decisión de privacidad explícita, y acá está resuelta así:
--
--   La tabla NO es legible por `anon`. La lectura pasa por una función
--   `security definer` que devuelve sólo las columnas públicas. RLS no puede
--   filtrar por columna, así que abrir un `select` anónimo sobre la tabla
--   expondría también el `user_id` del dueño; con la función, lo que sale está
--   enumerado a mano y no puede crecer por accidente al agregar una columna.
--
-- El id de la sala ES el token de invitación: un uuid v4 son 122 bits de
-- entropía, así que adivinarlo no es una vía de ataque realista.

create table if not exists public.rooms (
  id              uuid primary key,
  user_id         uuid not null references auth.users (id) on delete cascade,
  -- Copia del nombre del host: el invitado tiene que saber a quién acompaña, y
  -- no puede consultar auth.users.
  host_name       text not null default 'Alguien',
  label           text not null,
  mode            text not null,
  phase           text not null,
  status          text not null,
  ends_at         timestamptz,
  remaining_ms    bigint not null default 0,
  total_ms        bigint not null default 0,
  completed_focus integer not null default 0,
  skin_id         text not null default 'ring',
  updated_at      timestamptz not null default now(),
  closed_at       timestamptz
);

create index if not exists rooms_user_idx on public.rooms (user_id, closed_at);

alter table public.rooms enable row level security;

drop policy if exists rooms_owner on public.rooms;
create policy rooms_owner on public.rooms
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop trigger if exists rooms_touch on public.rooms;
create trigger rooms_touch before update on public.rooms
  for each row execute function public.touch_updated_at();

/**
 * Lectura pública de una sala.
 *
 * `security definer` para saltear RLS a propósito: es la única vía por la que un
 * invitado sin cuenta accede a algo. Devuelve columnas enumeradas —nunca
 * `select *`— y nada de `user_id`. El `set search_path` es obligatorio en una
 * función definer: sin él, un esquema malicioso en el search_path del llamador
 * podría secuestrar la resolución de nombres.
 */
create or replace function public.get_shared_room(room_id uuid)
returns table (
  id              uuid,
  host_name       text,
  label           text,
  mode            text,
  phase           text,
  status          text,
  ends_at         timestamptz,
  remaining_ms    bigint,
  total_ms        bigint,
  completed_focus integer,
  skin_id         text,
  updated_at      timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id, r.host_name, r.label, r.mode, r.phase, r.status,
    r.ends_at, r.remaining_ms, r.total_ms, r.completed_focus, r.skin_id, r.updated_at
  from public.rooms r
  where r.id = room_id
    and r.closed_at is null;
$$;

-- Acá el acceso anónimo SÍ es lo buscado, pero se declara en lugar de heredarse
-- de PUBLIC: así el permiso queda acotado a los dos roles que existen hoy y no
-- se extiende solo a cualquier rol que se cree mañana.
revoke execute on function public.get_shared_room(uuid) from public;
grant execute on function public.get_shared_room(uuid) to anon, authenticated;
