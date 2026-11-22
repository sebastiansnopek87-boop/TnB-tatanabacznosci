-- Add indexes for foreign-key columns identified by the Supabase Performance Advisor.
-- The affected tables are currently small; these indexes support joins and parent
-- row updates/deletes without changing data or RLS behaviour.

CREATE INDEX IF NOT EXISTS ai_materials_proposal_id_idx
  ON public.ai_materials (proposal_id);

CREATE INDEX IF NOT EXISTS ai_proposals_analysis_id_idx
  ON public.ai_proposals (analysis_id);

CREATE INDEX IF NOT EXISTS article_ai_origin_material_id_idx
  ON public.article_ai_origin (material_id);

CREATE INDEX IF NOT EXISTS article_saves_article_id_idx
  ON public.article_saves (article_id);

CREATE INDEX IF NOT EXISTS articles_category_idx
  ON public.articles (category);

CREATE INDEX IF NOT EXISTS library_items_category_idx
  ON public.library_items (category);

CREATE INDEX IF NOT EXISTS library_orders_item_id_idx
  ON public.library_orders (item_id);

-- Keep the equivalent provider_ref_uq index; this duplicate has no constraint dependency.
DROP INDEX IF EXISTS public.library_orders_provider_ref;

DO $$
BEGIN
  IF to_regclass('public.ai_materials_proposal_id_idx') IS NULL
     OR to_regclass('public.ai_proposals_analysis_id_idx') IS NULL
     OR to_regclass('public.article_ai_origin_material_id_idx') IS NULL
     OR to_regclass('public.article_saves_article_id_idx') IS NULL
     OR to_regclass('public.articles_category_idx') IS NULL
     OR to_regclass('public.library_items_category_idx') IS NULL
     OR to_regclass('public.library_orders_item_id_idx') IS NULL THEN
    RAISE EXCEPTION 'One or more foreign-key support indexes are missing';
  END IF;
END $$;
