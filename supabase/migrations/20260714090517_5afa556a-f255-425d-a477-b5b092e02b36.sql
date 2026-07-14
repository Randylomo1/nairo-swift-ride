
-- 1. Tighten orders SELECT: remove the clause that let ANY rider read full unassigned orders.
DROP POLICY IF EXISTS "Order customer read" ON public.orders;
CREATE POLICY "Order participants read"
  ON public.orders FOR SELECT
  USING (
    auth.uid() = customer_id
    OR auth.uid() = rider_id
    OR public.has_role(auth.uid(), 'admin')
  );

-- 2. Safe RPC for available jobs — approved online riders only, sanitized fields.
CREATE OR REPLACE FUNCTION public.get_available_jobs()
RETURNS TABLE (
  id uuid,
  order_number text,
  pickup_area text,
  dropoff_area text,
  distance_km numeric,
  eta_minutes integer,
  fare_kes numeric,
  package_category text,
  package_weight_kg numeric,
  package_size text,
  fragile boolean,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    o.order_number,
    -- Coarsen the address to the first comma-separated segment (neighborhood).
    split_part(o.pickup_address, ',', 1) AS pickup_area,
    split_part(o.dropoff_address, ',', 1) AS dropoff_area,
    o.distance_km,
    o.eta_minutes,
    o.fare_kes,
    o.package_category,
    o.package_weight_kg,
    o.package_size,
    o.fragile,
    o.created_at
  FROM public.orders o
  WHERE o.rider_id IS NULL
    AND o.payment_status = 'success'
    AND o.status IN ('paid', 'rider_assigned')
    AND EXISTS (
      SELECT 1 FROM public.riders r
      WHERE r.id = auth.uid() AND r.approved = true AND r.online = true
    )
  ORDER BY o.created_at ASC
  LIMIT 30;
$$;

REVOKE ALL ON FUNCTION public.get_available_jobs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_available_jobs() TO authenticated;

-- 3. Atomic accept — prevents double assignment.
CREATE OR REPLACE FUNCTION public.accept_order(_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _ok boolean;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.riders WHERE id = _uid AND approved = true) THEN
    RAISE EXCEPTION 'Rider not approved';
  END IF;

  UPDATE public.orders
     SET rider_id = _uid,
         status   = 'rider_assigned'
   WHERE id = _order_id
     AND rider_id IS NULL
     AND payment_status = 'success';

  GET DIAGNOSTICS _ok = ROW_COUNT;
  RETURN _ok > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_order(uuid) TO authenticated;
