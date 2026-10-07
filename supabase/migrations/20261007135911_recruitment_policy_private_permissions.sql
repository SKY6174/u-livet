-- PostgreSQL grants EXECUTE to PUBLIC by default, including in private schemas.
-- Only the authenticated wrapper may call these role-checked implementations.
revoke execute on function life_private.create_recruitment_policy_draft(uuid,text,text,text,text),
  life_private.update_recruitment_policy_draft(uuid,text,text,text,text),
  life_private.approve_recruitment_policy_draft(uuid,text,text)
from public, anon;

grant execute on function life_private.create_recruitment_policy_draft(uuid,text,text,text,text),
  life_private.update_recruitment_policy_draft(uuid,text,text,text,text),
  life_private.approve_recruitment_policy_draft(uuid,text,text)
to authenticated;
