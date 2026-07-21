-- Migration: Delsjekk (parts check)
-- Kobler eide SET-objekter mot den offisielle Rebrickable-delelisten, og gir
-- views + funksjoner for å generere en avkryssingsliste, regne ut
-- kompletthet (%) og produsere en manglerliste med BrickLink-fargekoder.
--
-- Alle views bruker security_invoker = on slik at RLS gjelder for innlogget
-- bruker (man ser kun egne objekter / egne inventory_parts-rader).
-- Kjøres i Supabase SQL Editor.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Oppslag: eid SET  ->  kanonisk Rebrickable-inventar
--
--    objects.set_number er lagret "bart" (10297), mens Rebrickable bruker
--    versjonssuffiks (10297-1). Vi matcher eksakt først, deretter med '-1'.
--    Et sett kan ha flere rb_inventories-rader; vi velger høyeste version.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_owned_set_resolved
WITH (security_invoker = on) AS
SELECT
  o.id         AS object_id,
  o.user_id,
  o.set_number,
  o.name,
  r.rb_set_num,
  inv.inventory_id
FROM objects o
CROSS JOIN LATERAL (
  SELECT COALESCE(
    (SELECT rs.set_num FROM rb_sets rs WHERE rs.set_num = o.set_number),
    (SELECT rs.set_num FROM rb_sets rs WHERE rs.set_num = o.set_number || '-1')
  ) AS rb_set_num
) r
LEFT JOIN LATERAL (
  SELECT i.id AS inventory_id
  FROM rb_inventories i
  WHERE i.set_num = r.rb_set_num
  ORDER BY i.version DESC
  LIMIT 1
) inv ON true
WHERE o.object_type = 'SET';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Forventet deleliste for et objekt (fasit fra Rebrickable)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_set_expected_parts
WITH (security_invoker = on) AS
SELECT
  res.object_id,
  res.user_id,
  ip.part_num,
  p.name        AS part_name,
  ip.color_id,
  c.name        AS color_name,
  ip.quantity   AS qty_expected,
  ip.is_spare,
  ip.img_url    AS part_img_url
FROM v_owned_set_resolved res
JOIN rb_inventory_parts ip ON ip.inventory_id = res.inventory_id
LEFT JOIN rb_parts  p ON p.part_num = ip.part_num
LEFT JOIN rb_colors c ON c.id = ip.color_id
WHERE res.inventory_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Generer/oppdater avkryssingslisten for ett objekt (idempotent)
--
--    Kun ikke-reservedeler lagres: unik-constrainten er
--    (object_id, part_num, color_id), og en reservedel har som regel samme
--    part_num + color_id som en ordinær del. Reservedeler vises i UI direkte
--    fra v_set_expected_parts.
--
--    qty_present bevares ved re-kjøring — kun fasit-feltene oppdateres.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_parts_checklist(p_object_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  n INTEGER;
BEGIN
  INSERT INTO inventory_parts (
    object_id, user_id, part_num, color_id, color_name,
    qty_expected, qty_present, is_spare, part_name, part_img_url
  )
  SELECT
    e.object_id,
    e.user_id,
    e.part_num,
    e.color_id,
    COALESCE(e.color_name, '(ukjent farge)'),
    SUM(e.qty_expected)::INTEGER,
    0,
    false,
    MAX(e.part_name),
    MAX(e.part_img_url)
  FROM v_set_expected_parts e
  WHERE e.object_id = p_object_id
    AND NOT e.is_spare
  -- Aggregering sikrer at ON CONFLICT aldri treffer samme rad to ganger
  GROUP BY e.object_id, e.user_id, e.part_num, e.color_id, e.color_name
  ON CONFLICT (object_id, part_num, color_id) DO UPDATE
    SET qty_expected = EXCLUDED.qty_expected,
        color_name   = EXCLUDED.color_name,
        part_name    = EXCLUDED.part_name,
        part_img_url = EXCLUDED.part_img_url,
        updated_at   = now();

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Masseoppdatering: "har alle" / "nullstill"
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_all_parts_present(p_object_id UUID, p_full BOOLEAN)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  n INTEGER;
BEGIN
  UPDATE inventory_parts
  SET qty_present = CASE WHEN p_full THEN qty_expected ELSE 0 END,
      updated_at  = now()
  WHERE object_id = p_object_id;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Kompletthet per objekt (kun ikke-reservedeler teller)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_object_parts_completeness
WITH (security_invoker = on) AS
SELECT
  ip.object_id,
  ip.user_id,
  COUNT(*)::INTEGER                                              AS lots_expected,
  SUM(ip.qty_expected)::INTEGER                                  AS pieces_expected,
  SUM(LEAST(ip.qty_present, ip.qty_expected))::INTEGER           AS pieces_present,
  SUM(GREATEST(ip.qty_expected - ip.qty_present, 0))::INTEGER    AS pieces_missing,
  COUNT(*) FILTER (WHERE ip.qty_present < ip.qty_expected)::INTEGER AS lots_missing,
  ROUND(
    100.0 * SUM(LEAST(ip.qty_present, ip.qty_expected))
          / NULLIF(SUM(ip.qty_expected), 0)
  , 1)                                                           AS percent_complete
FROM inventory_parts ip
WHERE NOT ip.is_spare
GROUP BY ip.object_id, ip.user_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Manglerliste med BrickLink-fargekoder (til want list / kjøp)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_object_missing_parts
WITH (security_invoker = on) AS
SELECT
  ip.object_id,
  ip.user_id,
  ip.part_num,
  ip.part_name,
  ip.color_id,
  ip.color_name,
  ip.part_img_url,
  ip.qty_expected,
  ip.qty_present,
  (ip.qty_expected - ip.qty_present)                  AS qty_missing,
  COALESCE(cm.bl_color_id, rc.bl_color_id)            AS bl_color_id,
  COALESCE(cm.bl_color_name, rc.bl_color_name)        AS bl_color_name
FROM inventory_parts ip
LEFT JOIN color_map cm ON cm.rb_color_id = ip.color_id
LEFT JOIN rb_colors rc ON rc.id = ip.color_id
WHERE NOT ip.is_spare
  AND ip.qty_present < ip.qty_expected;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Rettigheter
-- ─────────────────────────────────────────────────────────────────────────────
GRANT SELECT ON v_owned_set_resolved        TO authenticated;
GRANT SELECT ON v_set_expected_parts        TO authenticated;
GRANT SELECT ON v_object_parts_completeness TO authenticated;
GRANT SELECT ON v_object_missing_parts      TO authenticated;

GRANT EXECUTE ON FUNCTION generate_parts_checklist(UUID)      TO authenticated;
GRANT EXECUTE ON FUNCTION set_all_parts_present(UUID, BOOLEAN) TO authenticated;
