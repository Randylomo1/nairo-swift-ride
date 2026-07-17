
CREATE OR REPLACE FUNCTION public.orders_customer_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins bypass
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- If updater is the customer (and not the assigned rider), lock sensitive fields
  IF auth.uid() = OLD.customer_id AND auth.uid() IS DISTINCT FROM OLD.rider_id THEN
    IF NEW.customer_id       IS DISTINCT FROM OLD.customer_id
       OR NEW.rider_id       IS DISTINCT FROM OLD.rider_id
       OR NEW.fare_kes       IS DISTINCT FROM OLD.fare_kes
       OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
       OR NEW.mpesa_receipt  IS DISTINCT FROM OLD.mpesa_receipt
       OR NEW.mpesa_checkout_request_id IS DISTINCT FROM OLD.mpesa_checkout_request_id
       OR NEW.distance_km    IS DISTINCT FROM OLD.distance_km
       OR NEW.pickup_address IS DISTINCT FROM OLD.pickup_address
       OR NEW.dropoff_address IS DISTINCT FROM OLD.dropoff_address
       OR NEW.pickup_lat     IS DISTINCT FROM OLD.pickup_lat
       OR NEW.pickup_lng     IS DISTINCT FROM OLD.pickup_lng
       OR NEW.dropoff_lat    IS DISTINCT FROM OLD.dropoff_lat
       OR NEW.dropoff_lng    IS DISTINCT FROM OLD.dropoff_lng
       OR NEW.fare_kes       IS DISTINCT FROM OLD.fare_kes THEN
      RAISE EXCEPTION 'Customers may not modify pricing, payment, or address fields';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.orders_customer_update_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS orders_customer_update_guard_trg ON public.orders;
CREATE TRIGGER orders_customer_update_guard_trg
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.orders_customer_update_guard();
