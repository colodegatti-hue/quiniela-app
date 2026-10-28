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
