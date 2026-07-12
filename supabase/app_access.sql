-- Registro de accesos a la app (quién entra y cuándo). Se inserta como mucho una
-- fila por usuario cada 15 min (throttle en el código). Solo lo ve el líder.
create table if not exists app_access (
  id    bigint generated always as identity primary key,
  email text,
  at    timestamptz default now()
);
create index if not exists app_access_at_idx on app_access (at desc);
create index if not exists app_access_email_at_idx on app_access (email, at desc);
grant all privileges on table app_access to service_role;
grant usage, select on sequence app_access_id_seq to service_role;
