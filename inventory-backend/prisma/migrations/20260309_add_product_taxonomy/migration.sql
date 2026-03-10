BEGIN;

CREATE TABLE IF NOT EXISTS public.product_lines (
  id uuid NOT NULL,
  name text NOT NULL,
  normalized_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT product_lines_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS product_lines_normalized_name_key
  ON public.product_lines (normalized_name);

CREATE TABLE IF NOT EXISTS public.product_sub_lines (
  id uuid NOT NULL,
  line_id uuid NOT NULL,
  name text NOT NULL,
  normalized_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT product_sub_lines_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS product_sub_lines_line_id_normalized_name_key
  ON public.product_sub_lines (line_id, normalized_name);

CREATE INDEX IF NOT EXISTS product_sub_lines_line_id_idx
  ON public.product_sub_lines (line_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_sub_lines_line_id_fkey'
      AND conrelid = 'public.product_sub_lines'::regclass
  ) THEN
    ALTER TABLE public.product_sub_lines
      ADD CONSTRAINT product_sub_lines_line_id_fkey
      FOREIGN KEY (line_id)
      REFERENCES public.product_lines(id)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.product_categories (
  id uuid NOT NULL,
  sub_line_id uuid NOT NULL,
  name text NOT NULL,
  normalized_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT product_categories_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS product_categories_sub_line_id_normalized_name_key
  ON public.product_categories (sub_line_id, normalized_name);

CREATE INDEX IF NOT EXISTS product_categories_sub_line_id_idx
  ON public.product_categories (sub_line_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_categories_sub_line_id_fkey'
      AND conrelid = 'public.product_categories'::regclass
  ) THEN
    ALTER TABLE public.product_categories
      ADD CONSTRAINT product_categories_sub_line_id_fkey
      FOREIGN KEY (sub_line_id)
      REFERENCES public.product_sub_lines(id)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.product_sub_categories (
  id uuid NOT NULL,
  category_id uuid NOT NULL,
  name text NOT NULL,
  normalized_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT product_sub_categories_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS product_sub_categories_category_id_normalized_name_key
  ON public.product_sub_categories (category_id, normalized_name);

CREATE INDEX IF NOT EXISTS product_sub_categories_category_id_idx
  ON public.product_sub_categories (category_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_sub_categories_category_id_fkey'
      AND conrelid = 'public.product_sub_categories'::regclass
  ) THEN
    ALTER TABLE public.product_sub_categories
      ADD CONSTRAINT product_sub_categories_category_id_fkey
      FOREIGN KEY (category_id)
      REFERENCES public.product_categories(id)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END $$;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS line_id uuid,
  ADD COLUMN IF NOT EXISTS sub_line_id uuid,
  ADD COLUMN IF NOT EXISTS product_category_id uuid,
  ADD COLUMN IF NOT EXISTS sub_category_id uuid;

CREATE INDEX IF NOT EXISTS products_line_id_idx
  ON public.products (line_id);

CREATE INDEX IF NOT EXISTS products_sub_line_id_idx
  ON public.products (sub_line_id);

CREATE INDEX IF NOT EXISTS products_product_category_id_idx
  ON public.products (product_category_id);

CREATE INDEX IF NOT EXISTS products_sub_category_id_idx
  ON public.products (sub_category_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_line_id_fkey'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_line_id_fkey
      FOREIGN KEY (line_id)
      REFERENCES public.product_lines(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_sub_line_id_fkey'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_sub_line_id_fkey
      FOREIGN KEY (sub_line_id)
      REFERENCES public.product_sub_lines(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_product_category_id_fkey'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_product_category_id_fkey
      FOREIGN KEY (product_category_id)
      REFERENCES public.product_categories(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_sub_category_id_fkey'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_sub_category_id_fkey
      FOREIGN KEY (sub_category_id)
      REFERENCES public.product_sub_categories(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;
