-- Arregla la duplicación de registros de guerra y evita que vuelva a pasar.
-- Causa: varias capturas simultáneas (cron horario + al abrir + snapshot) hacían
-- borrar+insertar (no atómico). Solución: claves únicas + upsert idempotente.
-- Ejecutar en Supabase (una vez).

-- 1) Elimina duplicados existentes, conservando una fila por clave.
delete from war_members a using war_members b
  where a.ctid < b.ctid and a.war_id = b.war_id and a.tag = b.tag;

delete from war_attacks a using war_attacks b
  where a.ctid < b.ctid and a.war_id = b.war_id and a.attack_order = b.attack_order;

-- 2) Claves únicas para que el upsert no pueda duplicar.
create unique index if not exists war_members_war_tag_uidx  on war_members (war_id, tag);
create unique index if not exists war_attacks_war_order_uidx on war_attacks (war_id, attack_order);
