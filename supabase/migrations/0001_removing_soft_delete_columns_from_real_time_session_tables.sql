ALTER TABLE gig_sessions DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE gig_sessions DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE gig_session_participants DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE gig_session_participants DROP COLUMN IF EXISTS deleted_by;

ALTER TABLE gig_skipped_songs DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE gig_skipped_songs DROP COLUMN IF EXISTS deleted_by;