-- Drop audit triggers for gig_sessions
DROP TRIGGER IF EXISTS audit_gig_sessions_changes ON public.gig_sessions;
DROP TRIGGER IF EXISTS audit_gig_session_changes ON public.gig_sessions; -- Checking alternative naming

-- Drop audit triggers for gig_session_participants
DROP TRIGGER IF EXISTS audit_gig_session_participants_changes ON public.gig_session_participants;
DROP TRIGGER IF EXISTS audit_participants_changes ON public.gig_session_participants;

-- Drop audit triggers for gig_skipped_songs
DROP TRIGGER IF EXISTS audit_gig_skipped_songs_changes ON public.gig_skipped_songs;
DROP TRIGGER IF EXISTS audit_skipped_songs_changes ON public.gig_skipped_songs;

-- Ensure no soft delete metadata triggers remain (Double check)
DROP TRIGGER IF EXISTS tr_gig_sessions_soft_delete_meta ON public.gig_sessions;
DROP TRIGGER IF EXISTS tr_gig_participants_soft_delete_meta ON public.gig_session_participants;
DROP TRIGGER IF EXISTS tr_skipped_songs_soft_delete_meta ON public.gig_skipped_songs;