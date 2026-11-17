ALTER TABLE public.library_items
  ADD COLUMN IF NOT EXISTS subtitle text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sales_description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS reader_value text NOT NULL DEFAULT '';