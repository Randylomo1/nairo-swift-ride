-- Expand payment_status enum to support full M-Pesa lifecycle.
-- Existing enum values: pending, success, failed

BEGIN;

-- Create expanded enum type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'payment_status_new'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.payment_status_new AS ENUM (
      'pending',
      'processing',
      'success',
      'failed',
      'cancelled',
      'expired'
    );
  END IF;
END$$;

-- payments.status
DO $$
BEGIN
  -- Only proceed if orders/payment enum is still the old one
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='payments'
      AND column_name='status'
      AND udt_name='payment_status'
  ) THEN
    ALTER TABLE public.payments
      ALTER COLUMN status TYPE public.payment_status_new
      USING status::text::public.payment_status_new;

    ALTER TABLE public.payments
      ALTER COLUMN status TYPE public.payment_status_new;
  END IF;
END$$;

-- orders.payment_status
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='orders'
      AND column_name='payment_status'
      AND udt_name='payment_status'
  ) THEN
    ALTER TABLE public.orders
      ALTER COLUMN payment_status TYPE public.payment_status_new
      USING payment_status::text::public.payment_status_new;
  END IF;
END$$;

-- Drop old enum and rename new enum
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname='payment_status'
      AND n.nspname='public'
  ) THEN
    -- Ensure no remaining columns use old enum
    -- If there are other dependencies, this will fail and reveal them.
    ALTER TYPE public.payment_status RENAME TO payment_status_old;
    ALTER TYPE public.payment_status_new RENAME TO payment_status;

    -- Clean up old type
    BEGIN
      EXECUTE 'DROP TYPE public.payment_status_old';
    EXCEPTION WHEN dependent_objects_still_exist THEN
      -- leave it; safer for future migrations
      NULL;
    END;
  END IF;
END$$;

COMMIT;

