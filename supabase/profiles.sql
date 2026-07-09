-- Vínculo usuario (auth) ↔ jugador de CoC (verificado con verifytoken).
-- Pegar y ejecutar en: Supabase → SQL Editor → New query → Run.
create table if not exists profiles (
  user_id     uuid primary key,           -- id de auth.users
  player_tag  text,                        -- tag verificado (#ABC123)
  verified_at timestamptz,
  updated_at  timestamptz default now()
);
-- El servidor accede con la SECRET KEY (service_role); el navegador no toca esta tabla.
grant all privileges on table profiles to service_role;
