
-- Storage policies: riders manage their own folder (path = <user_id>/...), admins read all
CREATE POLICY "Rider read own docs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'rider-documents' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin')));

CREATE POLICY "Rider upload own docs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'rider-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Rider update own docs" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'rider-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Rider delete own docs" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'rider-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Bootstrap first admin (no-op once any admin exists)
CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_admin boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE role='admin') INTO has_admin;
  IF has_admin THEN RETURN false; END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (auth.uid(), 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;
