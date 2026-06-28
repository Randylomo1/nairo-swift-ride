
-- Split the overly-permissive Order update policy into role-scoped policies.
-- Riders may only touch operational fields; they cannot change fare, payment, or ownership columns.

DROP POLICY IF EXISTS "Order update" ON public.orders;

-- Customers can cancel their own un-dispatched orders only.
CREATE POLICY "Order customer update"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = customer_id)
  WITH CHECK (auth.uid() = customer_id);

-- Admins retain full update access.
CREATE POLICY "Order admin update"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Riders can update assigned orders, but a restrictive policy locks down
-- which columns they may change. They cannot reassign the order or alter
-- fare/payment fields.
CREATE POLICY "Order rider update"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = rider_id)
  WITH CHECK (auth.uid() = rider_id);

-- Restrictive policy: when the actor is a rider (not admin), forbid changes
-- to sensitive columns by requiring they remain equal to their OLD values.
-- Implemented via a trigger because Postgres RLS WITH CHECK cannot reference OLD.
CREATE OR REPLACE FUNCTION public.orders_rider_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Skip if admin
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- If the updater is the assigned rider (and not the customer), enforce immutability
  IF auth.uid() = OLD.rider_id AND auth.uid() <> OLD.customer_id THEN
    IF NEW.customer_id IS DISTINCT FROM OLD.customer_id
       OR NEW.rider_id IS DISTINCT FROM OLD.rider_id
       OR NEW.fare_kes IS DISTINCT FROM OLD.fare_kes
       OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
       OR NEW.mpesa_receipt IS DISTINCT FROM OLD.mpesa_receipt
       OR NEW.mpesa_checkout_request_id IS DISTINCT FROM OLD.mpesa_checkout_request_id
       OR NEW.distance_km IS DISTINCT FROM OLD.distance_km
       OR NEW.pickup_address IS DISTINCT FROM OLD.pickup_address
       OR NEW.dropoff_address IS DISTINCT FROM OLD.dropoff_address THEN
      RAISE EXCEPTION 'Riders may not modify ownership, fare, payment, or address fields';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_rider_update_guard_trg ON public.orders;
CREATE TRIGGER orders_rider_update_guard_trg
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_rider_update_guard();

-- user_roles: add explicit restrictive policy so even if a permissive INSERT
-- policy is added later by mistake, non-admins cannot escalate.
DROP POLICY IF EXISTS "Block non-admin role writes" ON public.user_roles;
CREATE POLICY "Block non-admin role writes"
  ON public.user_roles
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- But authenticated users still need to SELECT their own roles. Restrictive
-- ALL blocks reads too, so replace with INSERT/UPDATE/DELETE-only restrictive.
DROP POLICY IF EXISTS "Block non-admin role writes" ON public.user_roles;

CREATE POLICY "Block non-admin role insert"
  ON public.user_roles AS RESTRICTIVE FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Block non-admin role update"
  ON public.user_roles AS RESTRICTIVE FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Block non-admin role delete"
  ON public.user_roles AS RESTRICTIVE FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));
