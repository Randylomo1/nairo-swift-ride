
-- 1. Orders lifecycle columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS archived_by_customer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS recipient_name text,
  ADD COLUMN IF NOT EXISTS recipient_phone text;

-- 2. Payments expiry
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '3 minutes');

-- Ensure enum values exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
                 WHERE t.typname = 'payment_status' AND e.enumlabel = 'expired') THEN
    ALTER TYPE public.payment_status ADD VALUE 'expired';
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
                 WHERE t.typname = 'payment_status' AND e.enumlabel = 'cancelled') THEN
    ALTER TYPE public.payment_status ADD VALUE 'cancelled';
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

-- 3. Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  order_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own notifications select" ON public.notifications;
CREATE POLICY "own notifications select" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own notifications update" ON public.notifications;
CREATE POLICY "own notifications update" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own notifications delete" ON public.notifications;
CREATE POLICY "own notifications delete" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);

-- 4. Support tickets
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own tickets select" ON public.support_tickets;
CREATE POLICY "own tickets select" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "own tickets insert" ON public.support_tickets;
CREATE POLICY "own tickets insert" ON public.support_tickets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "admin tickets update" ON public.support_tickets;
CREATE POLICY "admin tickets update" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Rider ratings
CREATE TABLE IF NOT EXISTS public.rider_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE,
  rider_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.rider_ratings TO authenticated;
GRANT ALL ON public.rider_ratings TO service_role;
ALTER TABLE public.rider_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rating select" ON public.rider_ratings;
CREATE POLICY "rating select" ON public.rider_ratings
  FOR SELECT TO authenticated
  USING (auth.uid() = customer_id OR auth.uid() = rider_id OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "rating insert customer" ON public.rider_ratings;
CREATE POLICY "rating insert customer" ON public.rider_ratings
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = customer_id
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND o.customer_id = auth.uid()
        AND o.rider_id = rider_id
        AND o.status = 'delivered'
    )
  );

-- 6. Public rider stats view (rider name comes from profiles)
CREATE OR REPLACE VIEW public.rider_public_stats
WITH (security_invoker = true) AS
SELECT
  r.id AS rider_id,
  p.full_name,
  COALESCE(r.rating, 0)::numeric(3,2) AS stored_rating,
  COALESCE(AVG(rr.rating), 0)::numeric(3,2) AS avg_rating,
  COUNT(rr.id)::int AS rating_count,
  (SELECT COUNT(*) FROM public.orders o WHERE o.rider_id = r.id AND o.status = 'delivered')::int AS completed_count
FROM public.riders r
LEFT JOIN public.profiles p ON p.id = r.id
LEFT JOIN public.rider_ratings rr ON rr.rider_id = r.id
WHERE r.approved = true
GROUP BY r.id, p.full_name, r.rating;

GRANT SELECT ON public.rider_public_stats TO authenticated;

-- 7. RPCs

CREATE OR REPLACE FUNCTION public.cancel_order(_order_id uuid, _reason text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _n int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  UPDATE public.orders
     SET status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = _uid,
         cancel_reason = _reason,
         payment_status = CASE WHEN payment_status = 'success' THEN payment_status ELSE 'cancelled' END
   WHERE id = _order_id
     AND customer_id = _uid
     AND rider_id IS NULL
     AND (payment_status IS NULL OR payment_status <> 'success');

  GET DIAGNOSTICS _n = ROW_COUNT;
  IF _n = 0 THEN RETURN false; END IF;

  UPDATE public.payments
     SET status = 'cancelled'
   WHERE order_id = _order_id
     AND status = 'pending';

  INSERT INTO public.notifications(user_id, type, title, body, order_id)
  VALUES (_uid, 'order_cancelled', 'Order cancelled', 'Your order was cancelled.', _order_id);

  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.cancel_order(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_order(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.archive_order(_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _n int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  UPDATE public.orders
     SET archived_by_customer = true
   WHERE id = _order_id
     AND customer_id = _uid
     AND status IN ('delivered', 'cancelled');

  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n > 0;
END $$;
REVOKE ALL ON FUNCTION public.archive_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_order(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.expire_stale_payments()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _n int;
BEGIN
  WITH expired AS (
    UPDATE public.payments
       SET status = 'expired'
     WHERE status = 'pending'
       AND expires_at < now()
    RETURNING order_id
  )
  UPDATE public.orders o
     SET payment_status = 'expired',
         status = CASE WHEN o.status = 'payment_pending' THEN 'created' ELSE o.status END
    FROM expired e
   WHERE o.id = e.order_id
     AND o.payment_status = 'pending';

  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END $$;
REVOKE ALL ON FUNCTION public.expire_stale_payments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expire_stale_payments() TO authenticated;

-- 8. Trigger: notify customer on order status change
CREATE OR REPLACE FUNCTION public.orders_notify_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications(user_id, type, title, body, order_id)
    VALUES (
      NEW.customer_id,
      'order_status',
      CASE NEW.status
        WHEN 'rider_assigned' THEN 'Rider assigned'
        WHEN 'heading_to_pickup' THEN 'Rider heading to pickup'
        WHEN 'picked_up' THEN 'Package picked up'
        WHEN 'in_transit' THEN 'Package in transit'
        WHEN 'out_for_delivery' THEN 'Out for delivery'
        WHEN 'delivered' THEN 'Package delivered'
        WHEN 'cancelled' THEN 'Order cancelled'
        WHEN 'paid' THEN 'Payment received'
        ELSE 'Order update'
      END,
      'Order ' || NEW.order_number || ' status: ' || replace(NEW.status::text, '_', ' '),
      NEW.id
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS orders_notify_customer_trg ON public.orders;
CREATE TRIGGER orders_notify_customer_trg
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_notify_customer();

DROP TRIGGER IF EXISTS support_tickets_touch ON public.support_tickets;
CREATE TRIGGER support_tickets_touch
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
