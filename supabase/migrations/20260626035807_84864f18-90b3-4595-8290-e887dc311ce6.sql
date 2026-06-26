
DROP POLICY IF EXISTS "Rider self read" ON public.riders;
CREATE POLICY "Rider self or admin read" ON public.riders
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE VIEW public.riders_public
WITH (security_invoker = true) AS
SELECT
  r.id,
  p.full_name,
  r.rating,
  r.total_deliveries,
  r.online,
  r.approved,
  r.current_lat,
  r.current_lng
FROM public.riders r
LEFT JOIN public.profiles p ON p.id = r.id
WHERE r.approved = true;

GRANT SELECT ON public.riders_public TO authenticated, anon;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Profiles approved rider read'
  ) THEN
    CREATE POLICY "Profiles approved rider read" ON public.profiles
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.riders r WHERE r.id = profiles.id AND r.approved = true));
  END IF;
END$$;

CREATE POLICY "Admins manage roles insert" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles update" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles delete" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.claim_first_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
