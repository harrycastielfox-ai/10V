-- Minimal platform grants confirmed by the parent recovery agent using only
-- catalog/privilege metadata on 2026-10-25. No production rows were read.
-- authenticated: USAGE public=true, CREATE public=false; SELECT profiles=true;
-- INSERT/UPDATE/DELETE profiles=false. This is not an ALL TABLES/default grant
-- approximation. The profiles self-select policy remains in the real history.
grant usage on schema public to authenticated;
grant select on table public.profiles to authenticated;
