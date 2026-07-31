CREATE TABLE public.group_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  owner_id uuid NOT NULL,
  group_id text NOT NULL,
  group_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_invites TO authenticated;
GRANT ALL ON public.group_invites TO service_role;

ALTER TABLE public.group_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their invites"
ON public.group_invites FOR ALL TO authenticated
USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TABLE public.group_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid NOT NULL REFERENCES public.group_invites(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  applied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX group_join_requests_invite_id_idx ON public.group_join_requests(invite_id);

GRANT SELECT, UPDATE, DELETE ON public.group_join_requests TO authenticated;
GRANT ALL ON public.group_join_requests TO service_role;

ALTER TABLE public.group_join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Invite owners read join requests"
ON public.group_join_requests FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.group_invites i WHERE i.id = invite_id AND i.owner_id = auth.uid()));

CREATE POLICY "Invite owners update join requests"
ON public.group_join_requests FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.group_invites i WHERE i.id = invite_id AND i.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.group_invites i WHERE i.id = invite_id AND i.owner_id = auth.uid()));

CREATE TRIGGER touch_group_invites
BEFORE UPDATE ON public.group_invites
FOR EACH ROW EXECUTE FUNCTION public.touch_user_data_updated_at();

CREATE TRIGGER touch_group_join_requests
BEFORE UPDATE ON public.group_join_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_user_data_updated_at();