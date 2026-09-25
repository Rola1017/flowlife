-- FlowLife G1 回滾。已壓回的 updated_at 值無法自動還原。
-- 誤 stamp 救援：UPDATE public.sessions SET deleted_at = NULL WHERE uuid = :uuid AND user_id = auth.uid();

DROP TRIGGER IF EXISTS trg_sessions_stamp ON public.sessions;
DROP TRIGGER IF EXISTS trg_reviews_stamp ON public.reviews;
DROP TRIGGER IF EXISTS trg_app_state_stamp ON public.app_state;
DROP FUNCTION IF EXISTS public.flowlife_stamp_sync_cols();

DROP INDEX IF EXISTS public.sessions_user_updated_at_idx;
DROP INDEX IF EXISTS public.reviews_user_updated_at_idx;

ALTER TABLE public.sessions DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE public.reviews DROP COLUMN IF EXISTS deleted_at;

DROP POLICY IF EXISTS g1_migrate_backup_own ON public.g1_migrate_backup;
DROP TABLE IF EXISTS public.g1_migrate_backup;
