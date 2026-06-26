
DROP POLICY IF EXISTS "Roles self read" ON public.user_roles;
CREATE POLICY "Roles self read" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Explicit restrictive deny: anon can never read/write user_roles
CREATE POLICY "Deny anon all" ON public.user_roles
  AS RESTRICTIVE
  FOR ALL TO anon
  USING (false) WITH CHECK (false);

REVOKE ALL ON public.user_roles FROM anon, PUBLIC;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
