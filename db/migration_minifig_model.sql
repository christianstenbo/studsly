-- Migration: Minifigurmodell + delsjekk v2
--
-- Bygger videre på db/migration_parts_check.sql (v1):
--   1. Ny oppslagsrekkefølge i v_owned_set_resolved — rebrickable_id og
--      BL-nummer går foran bart settnummer, som ga feil CMF-figur.
--   2. Minifigurer blir en førsteklasses enhet (object_minifigs) med
--      antall + montert/demontert tilstand og kilde (sett/BAM/CMF/løs).
--   3. Kompletthet teller nå både løse deler og minifigurdeler.
--   4. Grunnmur for armeer (armies + army_members) — ingen UI ennå.
--   5. Etterfyller objects.num_parts / num_minifigs fra katalogen.
--
-- Del/figur-modell: en del er enten fri (løs) eller låst i en montert
-- beholder. En minifigurs deler ligger *kun* i object_minifigs, aldri i
-- inventory_parts — Rebrickable holder settets løsdeler og figurdeler i
-- hver sine tabeller, så ingen del blir dobbelttalt.
--
-- Kjøres i Supabase SQL Editor.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Minifigurer knyttet til et eid objekt
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS object_minifigs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id     UUID NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id),
  fig_num       TEXT NOT NULL,
  fig_name      TEXT,
  fig_img_url   TEXT,
  fig_num_parts INTEGER NOT NULL DEFAULT 0,
  qty_expected  INTEGER NOT NULL DEFAULT 1,
  qty_present   INTEGER NOT NULL DEFAULT 0,
  -- Montert figur = delene er låst. Demontert = delene er frie.
  is_assembled  BOOLEAN NOT NULL DEFAULT true,
  -- Hvor figuren kommer fra — grunnlag for oppdeling av figurtellingen
  source        TEXT NOT NULL DEFAULT 'SET'
                CHECK (source IN ('SET', 'BAM', 'CMF', 'STANDALONE')),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT object_minifigs_unique_fig UNIQUE (object_id, fig_num)
);

CREATE INDEX IF NOT EXISTS idx_object_minifigs_object_id ON object_minifigs(object_id);
CREATE INDEX IF NOT EXISTS idx_object_minifigs_user_source ON object_minifigs(user_id, source);

DROP TRIGGER IF EXISTS set_object_minifigs_updated_at ON object_minifigs;
CREATE TRIGGER set_object_minifigs_updated_at
  BEFORE UPDATE ON object_minifigs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE object_minifigs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "object_minifigs: eier leser egne" ON object_minifigs;
CREATE POLICY "object_minifigs: eier leser egne"
  ON object_minifigs FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "object_minifigs: eier setter inn egne" ON object_minifigs;
CREATE POLICY "object_minifigs: eier setter inn egne"
  ON object_minifigs FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "object_minifigs: eier oppdaterer egne" ON object_minifigs;
CREATE POLICY "object_minifigs: eier oppdaterer egne"
  ON object_minifigs FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "object_minifigs: eier sletter egne" ON object_minifigs;
CREATE POLICY "object_minifigs: eier sletter egne"
  ON object_minifigs FOR DELETE USING (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Armeer — navngitte bunter av minifigurer/deler.
--    Kun datamodell i denne runden; Army Builder kommer senere.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS armies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id),
  name       TEXT NOT NULL,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT armies_unique_name_per_user UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS army_members (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  army_id           UUID NOT NULL REFERENCES armies(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id),
  object_minifig_id UUID REFERENCES object_minifigs(id) ON DELETE CASCADE,
  inventory_part_id UUID REFERENCES inventory_parts(id) ON DELETE CASCADE,
  quantity          INTEGER NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Et medlem er enten en figur eller en del, aldri begge
  CONSTRAINT army_members_one_target
    CHECK (num_nonnulls(object_minifig_id, inventory_part_id) = 1)
);

CREATE INDEX IF NOT EXISTS idx_army_members_army_id ON army_members(army_id);

DROP TRIGGER IF EXISTS set_armies_updated_at ON armies;
CREATE TRIGGER set_armies_updated_at
  BEFORE UPDATE ON armies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE armies ENABLE ROW LEVEL SECURITY;
ALTER TABLE army_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "armies: eier styrer egne" ON armies;
CREATE POLICY "armies: eier styrer egne"
  ON armies FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "army_members: eier styrer egne" ON army_members;
CREATE POLICY "army_members: eier styrer egne"
  ON army_members FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Ny oppslagsrekkefølge (v1 traff feil CMF-figur)
--
--    Prioritet:
--      1. objects.rebrickable_id — eksakt, deretter uten ledende nuller
--         i suffikset (71022-09 → 71022-9)
--      2. CMF via BL-nummer: serie fra set_number + figurnummer fra
--         bl_item_no (colhp-14 → 71022-14). Må gå FØR bart settnummer,
--         som ellers gir 71022-1 = Harry Potter.
--      3. set_number eksakt, deretter set_number || '-1'
--
--    Punkt 4 i briefen (fuzzy navnematch) er ikke tatt med: alle 95
--    CMF-objekter treffer allerede på regel 2, og fuzzy matching ville
--    bare innføre risiko for feiltreff uten å løse noe.
--
--    Filteret på object_type = 'SET' er fjernet — også løse minifigurer
--    og andre objekter skal kunne slås opp.
-- ─────────────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS v_object_missing_parts;
DROP VIEW IF EXISTS v_object_parts_completeness;
DROP VIEW IF EXISTS v_set_expected_parts;
DROP VIEW IF EXISTS v_owned_set_resolved;

CREATE VIEW v_owned_set_resolved
WITH (security_invoker = on) AS
SELECT
  o.id          AS object_id,
  o.user_id,
  o.object_type,
  o.set_number,
  o.bl_item_no,
  o.rebrickable_id,
  o.name,
  r.rb_set_num,
  inv.inventory_id,
  s.name        AS rb_name,
  s.year        AS rb_year,
  s.num_parts   AS rb_num_parts,
  s.img_url     AS rb_img_url
FROM objects o
CROSS JOIN LATERAL (
  SELECT COALESCE(
    (SELECT rs.set_num FROM rb_sets rs WHERE rs.set_num = o.rebrickable_id),
    (SELECT rs.set_num FROM rb_sets rs
      WHERE rs.set_num = regexp_replace(o.rebrickable_id, '-0*(\d+)$', '-\1')),
    (SELECT rs.set_num FROM rb_sets rs
      WHERE o.bl_item_no ~ '^col'
        AND rs.set_num = split_part(o.set_number, '-', 1) || '-'
                      || substring(o.bl_item_no FROM '-(\d+)$')),
    (SELECT rs.set_num FROM rb_sets rs WHERE rs.set_num = o.set_number),
    (SELECT rs.set_num FROM rb_sets rs WHERE rs.set_num = o.set_number || '-1')
  ) AS rb_set_num
) r
LEFT JOIN rb_sets s ON s.set_num = r.rb_set_num
LEFT JOIN LATERAL (
  SELECT i.id AS inventory_id
  FROM rb_inventories i
  WHERE i.set_num = r.rb_set_num
  ORDER BY i.version DESC
  LIMIT 1
) inv ON true
-- Løse deler og bulk har ingen egen deleliste. Uten dette filteret slår
-- f.eks. delen 6418411 opp mot «settet» 6418411-1.
WHERE o.object_type NOT IN ('PART', 'BULK');

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Fasit: løse deler og minifigurer
-- ─────────────────────────────────────────────────────────────────────────────
CREATE VIEW v_set_expected_parts
WITH (security_invoker = on) AS
SELECT
  res.object_id,
  res.user_id,
  ip.part_num,
  p.name      AS part_name,
  ip.color_id,
  c.name      AS color_name,
  ip.quantity AS qty_expected,
  ip.is_spare,
  ip.img_url  AS part_img_url
FROM v_owned_set_resolved res
JOIN rb_inventory_parts ip ON ip.inventory_id = res.inventory_id
LEFT JOIN rb_parts  p ON p.part_num = ip.part_num
LEFT JOIN rb_colors c ON c.id = ip.color_id
WHERE res.inventory_id IS NOT NULL;

CREATE OR REPLACE VIEW v_set_expected_minifigs
WITH (security_invoker = on) AS
SELECT
  res.object_id,
  res.user_id,
  im.fig_num,
  m.name       AS fig_name,
  m.num_parts  AS fig_num_parts,
  m.img_url    AS fig_img_url,
  im.quantity  AS qty_expected
FROM v_owned_set_resolved res
JOIN rb_inventory_minifigs im ON im.inventory_id = res.inventory_id
LEFT JOIN rb_minifigs m ON m.fig_num = im.fig_num
WHERE res.inventory_id IS NOT NULL;

-- Delene i hver minifigur som hører til et objekt (for utvidbare rader).
-- Funksjon framfor view: fig_num-filteret må presses helt ned i
-- rb_inventories, ellers skanner vi 1,5 mill. rader.
CREATE OR REPLACE FUNCTION object_minifig_parts(p_object_id UUID)
RETURNS TABLE (
  fig_num      TEXT,
  part_num     TEXT,
  part_name    TEXT,
  color_id     INTEGER,
  color_name   TEXT,
  quantity     INTEGER,
  is_spare     BOOLEAN,
  part_img_url TEXT
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    f.fig_num,
    ip.part_num,
    p.name    AS part_name,
    ip.color_id,
    c.name    AS color_name,
    ip.quantity,
    ip.is_spare,
    ip.img_url AS part_img_url
  FROM v_set_expected_minifigs f
  CROSS JOIN LATERAL (
    SELECT i.id
    FROM rb_inventories i
    WHERE i.set_num = f.fig_num
    ORDER BY i.version DESC
    LIMIT 1
  ) inv
  JOIN rb_inventory_parts ip ON ip.inventory_id = inv.id
  LEFT JOIN rb_parts  p ON p.part_num = ip.part_num
  LEFT JOIN rb_colors c ON c.id = ip.color_id
  WHERE f.object_id = p_object_id;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Generer avkryssingsliste — nå også minifigurer (idempotent)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_parts_checklist(p_object_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  n_parts INTEGER;
  n_figs  INTEGER;
BEGIN
  -- Uten et treff i katalogen har vi ingen fasit å rydde mot, så vi lar
  -- eventuelle eksisterende rader stå urørt.
  IF NOT EXISTS (
    SELECT 1 FROM v_owned_set_resolved r
    WHERE r.object_id = p_object_id AND r.inventory_id IS NOT NULL
  ) THEN
    RETURN 0;
  END IF;

  -- Løse deler (reservedeler holdes utenfor: unik-constrainten er
  -- (object_id, part_num, color_id), og en reservedel deler som regel
  -- part_num + color_id med en ordinær del)
  INSERT INTO inventory_parts (
    object_id, user_id, part_num, color_id, color_name,
    qty_expected, qty_present, is_spare, part_name, part_img_url
  )
  SELECT
    e.object_id, e.user_id, e.part_num, e.color_id,
    COALESCE(e.color_name, '(ukjent farge)'),
    SUM(e.qty_expected)::INTEGER, 0, false,
    MAX(e.part_name), MAX(e.part_img_url)
  FROM v_set_expected_parts e
  WHERE e.object_id = p_object_id
    AND NOT e.is_spare
  GROUP BY e.object_id, e.user_id, e.part_num, e.color_id, e.color_name
  ON CONFLICT (object_id, part_num, color_id) DO UPDATE
    SET qty_expected = EXCLUDED.qty_expected,
        color_name   = EXCLUDED.color_name,
        part_name    = EXCLUDED.part_name,
        part_img_url = EXCLUDED.part_img_url,
        updated_at   = now();

  GET DIAGNOSTICS n_parts = ROW_COUNT;

  -- Minifigurer. Kilde utledes av objektet: CMF-pose, del av sett,
  -- eller løs figur. BAM må settes manuelt — det finnes ikke i katalogen.
  INSERT INTO object_minifigs (
    object_id, user_id, fig_num, fig_name, fig_img_url, fig_num_parts,
    qty_expected, qty_present, source
  )
  SELECT
    f.object_id, f.user_id, f.fig_num,
    MAX(f.fig_name), MAX(f.fig_img_url),
    COALESCE(MAX(f.fig_num_parts), 0),
    SUM(f.qty_expected)::INTEGER, 0,
    CASE
      WHEN o.bl_item_no ~ '^col'    THEN 'CMF'
      WHEN o.object_type = 'SET'    THEN 'SET'
      ELSE 'STANDALONE'
    END
  FROM v_set_expected_minifigs f
  JOIN objects o ON o.id = f.object_id
  WHERE f.object_id = p_object_id
  GROUP BY f.object_id, f.user_id, f.fig_num, o.bl_item_no, o.object_type
  ON CONFLICT (object_id, fig_num) DO UPDATE
    SET fig_name      = EXCLUDED.fig_name,
        fig_img_url   = EXCLUDED.fig_img_url,
        fig_num_parts = EXCLUDED.fig_num_parts,
        qty_expected  = EXCLUDED.qty_expected,
        updated_at    = now();

  GET DIAGNOSTICS n_figs = ROW_COUNT;

  -- Rydd bort rader som ikke lenger står i fasiten. Nødvendig fordi v1
  -- slo opp feil sett for CMF-ene: en Mad-Eye-pose fikk Harry Potters
  -- deler, og de må vekk når oppslaget rettes.
  DELETE FROM inventory_parts ip
  WHERE ip.object_id = p_object_id
    AND NOT EXISTS (
      SELECT 1 FROM v_set_expected_parts e
      WHERE e.object_id = ip.object_id
        AND NOT e.is_spare
        AND e.part_num = ip.part_num
        AND e.color_id = ip.color_id
    );

  DELETE FROM object_minifigs om
  WHERE om.object_id = p_object_id
    AND NOT EXISTS (
      SELECT 1 FROM v_set_expected_minifigs f
      WHERE f.object_id = om.object_id
        AND f.fig_num = om.fig_num
    );

  RETURN n_parts + n_figs;
END;
$$;

-- «Har alle» / «nullstill» — gjelder både deler og figurer
CREATE OR REPLACE FUNCTION set_all_parts_present(p_object_id UUID, p_full BOOLEAN)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  n INTEGER;
  m INTEGER;
BEGIN
  UPDATE inventory_parts
  SET qty_present = CASE WHEN p_full THEN qty_expected ELSE 0 END,
      updated_at  = now()
  WHERE object_id = p_object_id;
  GET DIAGNOSTICS n = ROW_COUNT;

  UPDATE object_minifigs
  SET qty_present = CASE WHEN p_full THEN qty_expected ELSE 0 END,
      updated_at  = now()
  WHERE object_id = p_object_id;
  GET DIAGNOSTICS m = ROW_COUNT;

  RETURN n + m;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Kompletthet — løse deler + minifigurdeler
-- ─────────────────────────────────────────────────────────────────────────────
CREATE VIEW v_object_parts_completeness
WITH (security_invoker = on) AS
WITH loose AS (
  SELECT
    object_id, user_id,
    COUNT(*)::INTEGER                                    AS lots_expected,
    SUM(qty_expected)::INTEGER                           AS pieces_expected,
    SUM(LEAST(qty_present, qty_expected))::INTEGER       AS pieces_present,
    COUNT(*) FILTER (WHERE qty_present < qty_expected)::INTEGER AS lots_missing
  FROM inventory_parts
  WHERE NOT is_spare
  GROUP BY object_id, user_id
),
figs AS (
  SELECT
    object_id, user_id,
    SUM(qty_expected)::INTEGER                     AS minifigs_expected,
    SUM(LEAST(qty_present, qty_expected))::INTEGER AS minifigs_present,
    SUM(qty_expected * fig_num_parts)::INTEGER     AS pieces_expected,
    SUM(LEAST(qty_present, qty_expected) * fig_num_parts)::INTEGER AS pieces_present
  FROM object_minifigs
  GROUP BY object_id, user_id
)
SELECT
  COALESCE(l.object_id, f.object_id) AS object_id,
  COALESCE(l.user_id,   f.user_id)   AS user_id,
  COALESCE(l.lots_expected, 0)       AS lots_expected,
  COALESCE(l.pieces_expected, 0) + COALESCE(f.pieces_expected, 0) AS pieces_expected,
  COALESCE(l.pieces_present, 0)  + COALESCE(f.pieces_present, 0)  AS pieces_present,
  (COALESCE(l.pieces_expected, 0) + COALESCE(f.pieces_expected, 0))
    - (COALESCE(l.pieces_present, 0) + COALESCE(f.pieces_present, 0)) AS pieces_missing,
  COALESCE(l.lots_missing, 0)        AS lots_missing,
  ROUND(
    100.0 * (COALESCE(l.pieces_present, 0) + COALESCE(f.pieces_present, 0))
          / NULLIF(COALESCE(l.pieces_expected, 0) + COALESCE(f.pieces_expected, 0), 0)
  , 1)                               AS percent_complete,
  COALESCE(f.minifigs_expected, 0)   AS minifigs_expected,
  COALESCE(f.minifigs_present, 0)    AS minifigs_present,
  COALESCE(l.pieces_expected, 0)     AS loose_pieces_expected,
  COALESCE(l.pieces_present, 0)      AS loose_pieces_present
FROM loose l
FULL JOIN figs f ON f.object_id = l.object_id AND f.user_id = l.user_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Manglerliste med BrickLink-fargekoder
-- ─────────────────────────────────────────────────────────────────────────────
CREATE VIEW v_object_missing_parts
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
  (ip.qty_expected - ip.qty_present)           AS qty_missing,
  COALESCE(cm.bl_color_id, rc.bl_color_id)     AS bl_color_id,
  COALESCE(cm.bl_color_name, rc.bl_color_name) AS bl_color_name
FROM inventory_parts ip
LEFT JOIN color_map cm ON cm.rb_color_id = ip.color_id
LEFT JOIN rb_colors rc ON rc.id = ip.color_id
WHERE NOT ip.is_spare
  AND ip.qty_present < ip.qty_expected;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Minifigursamlingen — telling av komplette figurer, delt på kilde
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_minifig_collection
WITH (security_invoker = on) AS
SELECT
  om.id AS object_minifig_id,
  om.user_id,
  om.object_id,
  om.fig_num,
  om.fig_name,
  om.fig_img_url,
  om.fig_num_parts,
  om.source,
  om.is_assembled,
  om.qty_expected,
  om.qty_present,
  o.name        AS object_name,
  o.set_number  AS object_set_number,
  o.theme       AS object_theme
FROM object_minifigs om
JOIN objects o ON o.id = om.object_id;

CREATE OR REPLACE VIEW v_minifig_counts_by_source
WITH (security_invoker = on) AS
SELECT
  user_id,
  source,
  SUM(qty_present)::INTEGER                                     AS complete_minifigs,
  SUM(qty_present) FILTER (WHERE is_assembled)::INTEGER         AS assembled_minifigs,
  COUNT(DISTINCT fig_num) FILTER (WHERE qty_present > 0)::INTEGER AS distinct_figs
FROM object_minifigs
GROUP BY user_id, source;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Rettigheter
-- ─────────────────────────────────────────────────────────────────────────────
GRANT SELECT ON v_owned_set_resolved         TO authenticated;
GRANT SELECT ON v_set_expected_parts         TO authenticated;
GRANT SELECT ON v_set_expected_minifigs      TO authenticated;
GRANT SELECT ON v_object_parts_completeness  TO authenticated;
GRANT SELECT ON v_object_missing_parts       TO authenticated;
GRANT SELECT ON v_minifig_collection         TO authenticated;
GRANT SELECT ON v_minifig_counts_by_source   TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON object_minifigs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON armies          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON army_members    TO authenticated;

GRANT EXECUTE ON FUNCTION generate_parts_checklist(UUID)       TO authenticated;
GRANT EXECUTE ON FUNCTION set_all_parts_present(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION object_minifig_parts(UUID)           TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Etterfyll objects.num_parts / num_minifigs fra katalogen.
--     rb_sets.num_parts inkluderer minifigurdelene (10278-1 = 2 923 =
--     2 903 løse + 5 figurer à 4 deler), så dette retter opp CMF-ene
--     v1 slo opp feil — Mad-Eye går fra 7 (Harrys tall) til 9.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE objects o
SET num_parts    = r.rb_num_parts,
    num_minifigs = COALESCE(fc.cnt, 0)
FROM v_owned_set_resolved r
LEFT JOIN LATERAL (
  SELECT SUM(im.quantity)::INTEGER AS cnt
  FROM rb_inventory_minifigs im
  WHERE im.inventory_id = r.inventory_id
) fc ON true
WHERE r.object_id = o.id
  AND r.rb_num_parts IS NOT NULL
  AND r.rb_num_parts > 0
  AND (o.num_parts IS DISTINCT FROM r.rb_num_parts
    OR o.num_minifigs IS DISTINCT FROM COALESCE(fc.cnt, 0));
