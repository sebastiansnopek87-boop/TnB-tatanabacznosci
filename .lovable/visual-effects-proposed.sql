ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS visual_effects jsonb NOT NULL DEFAULT
  '{"enabled":true,"intensity":"subtle","speed":"standard","reveal":true,"interactive":true,"panels":true}'::jsonb;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'platform_settings_visual_effects_valid') THEN
    ALTER TABLE public.platform_settings ADD CONSTRAINT platform_settings_visual_effects_valid CHECK (
      jsonb_typeof(visual_effects) = 'object'
      AND (visual_effects - ARRAY['enabled','intensity','speed','reveal','interactive','panels']) = '{}'::jsonb
      AND coalesce(visual_effects->>'intensity','subtle') IN ('subtle','standard','off')
      AND coalesce(visual_effects->>'speed','standard') IN ('fast','standard','calm')
      AND coalesce(jsonb_typeof(visual_effects->'enabled'),'boolean') = 'boolean'
      AND coalesce(jsonb_typeof(visual_effects->'reveal'),'boolean') = 'boolean'
      AND coalesce(jsonb_typeof(visual_effects->'interactive'),'boolean') = 'boolean'
      AND coalesce(jsonb_typeof(visual_effects->'panels'),'boolean') = 'boolean'
    );
  END IF;
END $$;

GRANT SELECT (visual_effects) ON public.platform_settings TO anon, authenticated;
COMMENT ON COLUMN public.platform_settings.visual_effects IS 'Public presentation flags for animations. Writes only via superadmin-authorized server function; logged.';
