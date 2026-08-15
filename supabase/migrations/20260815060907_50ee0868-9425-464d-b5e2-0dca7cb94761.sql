-- Shared groups
CREATE TABLE public.shared_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  state jsonb NOT NULL DEFAULT '{"members":[],"expenses":[],"payments":[],"budgets":{}}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.shared_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  display_name text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE TABLE public.group_email_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.shared_groups(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  email text NOT NULL,
  invited_by uuid NOT NULL,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_group_members_user ON public.group_members(user_id);
CREATE INDEX idx_group_email_invites_group ON public.group_email_invites(group_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_groups TO authenticated;
GRANT ALL ON public.shared_groups TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_email_invites TO authenticated;
GRANT ALL ON public.group_email_invites TO service_role;

-- Recursion-safe membership checks
CREATE OR REPLACE FUNCTION public.is_group_member(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _group_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_owner(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shared_groups
    WHERE id = _group_id AND owner_id = _user_id
  );
$$;

ALTER TABLE public.shared_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_email_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read their groups" ON public.shared_groups
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_group_member(id, auth.uid()));

CREATE POLICY "Owners create groups" ON public.shared_groups
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Members update their groups" ON public.shared_groups
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_group_member(id, auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_group_member(id, auth.uid()));

CREATE POLICY "Owners delete their groups" ON public.shared_groups
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Members read membership" ON public.group_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_group_member(group_id, auth.uid()) OR public.is_group_owner(group_id, auth.uid()));

CREATE POLICY "Owners add members" ON public.group_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_group_owner(group_id, auth.uid()));

CREATE POLICY "Members update own membership" ON public.group_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_group_owner(group_id, auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_group_owner(group_id, auth.uid()));

CREATE POLICY "Owner or self removes membership" ON public.group_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_group_owner(group_id, auth.uid()));

CREATE POLICY "Owners read invites" ON public.group_email_invites
  FOR SELECT TO authenticated
  USING (public.is_group_owner(group_id, auth.uid()));

CREATE POLICY "Owners create invites" ON public.group_email_invites
  FOR INSERT TO authenticated
  WITH CHECK (public.is_group_owner(group_id, auth.uid()) AND invited_by = auth.uid());

CREATE POLICY "Owners revoke invites" ON public.group_email_invites
  FOR DELETE TO authenticated
  USING (public.is_group_owner(group_id, auth.uid()));

CREATE TRIGGER touch_shared_groups BEFORE UPDATE ON public.shared_groups
  FOR EACH ROW EXECUTE FUNCTION public.touch_user_data_updated_at();
CREATE TRIGGER touch_group_members BEFORE UPDATE ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.touch_user_data_updated_at();
CREATE TRIGGER touch_group_email_invites BEFORE UPDATE ON public.group_email_invites
  FOR EACH ROW EXECUTE FUNCTION public.touch_user_data_updated_at();