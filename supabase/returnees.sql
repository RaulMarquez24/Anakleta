-- Control de "retornados": cuando un tag que estaba inactivo vuelve a aparecer,
-- se marca returned_at=ahora y return_reviewed=false para que un colíder lo revise
-- (puede tener nota/warns de su etapa anterior). Por defecto reviewed=true para
-- no marcar a los miembros ya existentes.
alter table members add column if not exists returned_at      timestamptz;
alter table members add column if not exists return_reviewed  boolean default true;
