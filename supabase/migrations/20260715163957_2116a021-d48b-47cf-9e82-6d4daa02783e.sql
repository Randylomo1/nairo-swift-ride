DROP POLICY IF EXISTS "Profiles approved rider read" ON public.profiles;

CREATE POLICY "Profiles rider visible to active customer"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.rider_id = profiles.id
      AND o.customer_id = auth.uid()
      AND o.status NOT IN ('delivered', 'cancelled')
  )
);