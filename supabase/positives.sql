-- Positivos (méritos) de miembros: lo contrario de un warn. Un colíder deja
-- constancia de algo que hizo bien ("ayudó a un nuevo", "guerra perfecta") y eso
-- SUMA puntos de participación para los ascensos. Nunca resta a nadie.
--
-- Los puntos van en la propia fila: así un positivo grande vale más que un
-- detalle, y cambiar el valor por defecto luego no reescribe el pasado.
-- La caducidad NO vive aquí: se calcula en lectura con settings.positives_days.
-- Ejecutar en Supabase.
create table if not exists positives (
  id         bigint generated always as identity primary key,
  member_tag text not null,
  reason     text not null,
  points     integer not null default 200,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists positives_member_idx on positives (member_tag, created_at desc);

grant all privileges on table positives to service_role;
grant usage, select on sequence positives_id_seq to service_role;

-- Valores por defecto de los positivos (editables en Clan → Normas).
insert into settings (key, value)
values ('positive_points', '200'), ('positives_days', '90')
on conflict (key) do nothing;
