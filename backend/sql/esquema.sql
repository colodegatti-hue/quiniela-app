-- =====================================================================
-- Esquema de la base (Neon / PostgreSQL 17) — Quiniela Colo Apps
-- Se puede correr varias veces sin romper nada (IF NOT EXISTS).
-- =====================================================================

-- Un sorteo = una fecha + un turno
create table if not exists sorteos (
  fecha date not null,
  turno text not null check (turno in ('previa','primera','matutina','vespertina','nocturna')),
  numero integer unique,                 -- n.º oficial de la Lotería (null si vino del respaldo)
  fuente text not null check (fuente in ('lotba','quinieleando')),
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
  fuente text not null check (fuente in ('lotba','quinieleando')),
  visto_en timestamptz not null default now(),
  minutos_demora numeric(6,1),
  primary key (fecha, turno, fuente)
);
