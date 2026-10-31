-- =====================================================================
-- Esquema de la base (Neon / PostgreSQL 17) — Quiniela Colo Apps
-- Se puede correr varias veces sin romper nada (IF NOT EXISTS).
-- =====================================================================

-- Un sorteo = una fecha + un turno
create table if not exists sorteos (
  fecha date not null,
  turno text not null check (turno in ('previa','primera','matutina','vespertina','nocturna')),
  numero integer unique,                 -- n.º oficial de la Lotería (null si vino del respaldo)
  fuente text not null check (fuente in ('lotba','quinieleando','provincia')),
  encontrado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  primary key (fecha, turno)
);

-- Los 20 números de cada quiniela en ese sorteo
create table if not exists extractos (
  fecha date not null,
  turno text not null,
  quiniela text not null,
  numeros text[] not null check (array_length(numeros, 1) = 20),
  letras text,
  primary key (fecha, turno, quiniela),
  foreign key (fecha, turno) references sorteos (fecha, turno) on delete cascade
);

-- Cuándo vio cada fuente el resultado por primera vez (para medir la demora)
create table if not exists publicaciones (
  fecha date not null,
  turno text not null,
  fuente text not null check (fuente in ('lotba','quinieleando','provincia')),
  visto_en timestamptz not null default now(),
  minutos_demora numeric(6,1),
  primary key (fecha, turno, fuente)
);

-- Teléfonos que activaron los avisos (notificaciones push)
create table if not exists suscripciones (
  endpoint text primary key,             -- dirección única que da el navegador
  p256dh text not null,
  auth text not null,
  dispositivo text,                      -- id anónimo del teléfono
  preferencias jsonb not null default '{}'::jsonb,   -- { cabezas, quinielas, recordatorio }
  jugadas jsonb not null default '[]'::jsonb,        -- copia de las jugadas para avisar aciertos
  fallos int not null default 0,
  creada timestamptz not null default now(),
  actualizada timestamptz not null default now()
);

-- ---- Versión Pro ----------------------------------------------------
-- Cada intento de compra (una preferencia de Mercado Pago)
create table if not exists compras (
  referencia text primary key,           -- external_reference en Mercado Pago
  codigo text not null,                  -- código de 6 dígitos que activa (nuevo o renovación)
  plan text not null check (plan in ('mensual','anual')),
  precio numeric(12,2) not null,
  estado text not null default 'pendiente' check (estado in ('pendiente','aprobada')),
  pago_id text unique,
  creada timestamptz not null default now(),
  aprobada timestamptz
);

-- Un código Pro activo (se renueva sumando días)
create table if not exists licencias (
  codigo text primary key check (codigo ~ '^[0-9]{6}$'),
  plan text not null,
  vence timestamptz not null,
  dispositivos text[] not null default '{}',   -- teléfonos que usan el código (máx. 3)
  nota text,                                   -- p. ej. 'cortesía'
  creada timestamptz not null default now()
);

alter table suscripciones add column if not exists codigo text;  -- código Pro del teléfono (para las alertas)

-- Fuente 'provincia' = loteria.gba.gob.ar (agregada el 20/10/2026). Para bases viejas:
alter table sorteos drop constraint if exists sorteos_fuente_check;
alter table sorteos add constraint sorteos_fuente_check check (fuente in ('lotba','quinieleando','provincia'));
alter table publicaciones drop constraint if exists publicaciones_fuente_check;
alter table publicaciones add constraint publicaciones_fuente_check check (fuente in ('lotba','quinieleando','provincia'));

-- Pedidos de arrepentimiento de compras Pro (Ley 24.240, art. 34; botón de arrepentimiento)
create table if not exists arrepentimientos (
  numero text primary key,               -- número de trámite que se le muestra a la persona
  codigo text,                           -- código Pro (si lo tiene)
  contacto text not null,                -- mail o teléfono para responder
  detalle text,
  estado text not null default 'pendiente' check (estado in ('pendiente','resuelto')),
  creado timestamptz not null default now()
);

-- Cabezas que se conocen antes que el extracto completo (para avisar y mostrar antes)
create table if not exists cabezas (
  fecha date not null,
  turno text not null,
  quiniela text not null,
  cabeza text not null check (cabeza ~ '^[0-9]{4}$'),
  fuente text not null,
  visto_en timestamptz not null default now(),
  primary key (fecha, turno, quiniela)
);

-- ---- Medición de uso (anónima) y panel administrativo ---------------
-- Cada teléfono que abrió la app (id anónimo generado en el teléfono)
create table if not exists dispositivos (
  id text primary key,
  origen text,                           -- de dónde llegó la primera vez: 'ag:CODIGO', 'inv', 'directo'...
  primera_vez timestamptz not null default now(),
  ultima_vez timestamptz not null default now()
);
create index if not exists dispositivos_primera on dispositivos (primera_vez);
create index if not exists dispositivos_origen on dispositivos (origen);

-- Un registro por teléfono y día en que usó la app
create table if not exists actividad (
  dia date not null,
  dispositivo text not null,
  pro boolean not null default false,
  primary key (dia, dispositivo)
);

-- Agencias amigas (cada una con su enlace y QR)
create table if not exists agencias (
  codigo text primary key check (codigo ~ '^[a-z0-9-]{2,30}$'),
  nombre text not null,
  localidad text,
  contacto text,
  activa boolean not null default true,
  creada timestamptz not null default now()
);

-- Entradas por el enlace/QR de cada agencia (cuenta escaneos, aunque el teléfono ya la tuviera)
create table if not exists visitas (
  dia date not null,
  origen text not null,
  cantidad int not null default 0,
  primary key (dia, origen)
);

-- Qué hizo el administrador en el panel
create table if not exists admin_registro (
  id bigserial primary key,
  cuando timestamptz not null default now(),
  accion text not null,
  detalle text,
  ip text
);

-- Compras: de qué teléfono y origen vinieron (para medir agencias)
alter table compras add column if not exists dispositivo text;
alter table compras add column if not exists origen text;

-- Recuperar el Pro en un celular nuevo con el número de operación (máx. 1 vez cada 2 días)
alter table licencias add column if not exists recuperada_en timestamptz;
