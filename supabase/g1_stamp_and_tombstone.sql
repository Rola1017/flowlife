-- FlowLife G1：雲端蓋章 + deleted_at 軟刪
-- 執行時機：Vercel 新 client 部署完成後立刻跑（不可提前數天）。
-- PG15+ 用 EXECUTE FUNCTION；若 SELECT version() 為 14.x 則改 EXECUTE PROCEDURE。

SELECT version();

SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename IN ('sessions', 'reviews', 'app_state')
ORDER BY tablename, policyname;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

ALTER TABLE public.sessions ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.reviews ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.app_state ALTER COLUMN updated_at SET DEFAULT now();

-- 只動同步欄位（INV-1）：updated_at 永遠 now()；
-- deleted_at 非 null 且有變更 → now()；deleted_at 設回 null 放行（還原）。
CREATE OR REPLACE FUNCTION public.flowlife_stamp_sync_cols()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_TABLE_NAME IN ('sessions', 'reviews') THEN
    IF NEW.deleted_at IS NOT NULL
       AND (TG_OP = 'INSERT' OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at) THEN
      NEW.deleted_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sessions_stamp ON public.sessions;
CREATE TRIGGER trg_sessions_stamp
  BEFORE INSERT OR UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.flowlife_stamp_sync_cols();

DROP TRIGGER IF EXISTS trg_reviews_stamp ON public.reviews;
CREATE TRIGGER trg_reviews_stamp
  BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.flowlife_stamp_sync_cols();

DROP TRIGGER IF EXISTS trg_app_state_stamp ON public.app_state;
CREATE TRIGGER trg_app_state_stamp
  BEFORE INSERT OR UPDATE ON public.app_state
  FOR EACH ROW EXECUTE FUNCTION public.flowlife_stamp_sync_cols();

CREATE INDEX IF NOT EXISTS sessions_user_updated_at_idx
  ON public.sessions (user_id, updated_at);
CREATE INDEX IF NOT EXISTS reviews_user_updated_at_idx
  ON public.reviews (user_id, updated_at);

GRANT SELECT, INSERT, UPDATE ON public.sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.app_state TO authenticated;

-- 搬家備份（INV-3：只新增，不刪現有業務列）
CREATE TABLE IF NOT EXISTS public.g1_migrate_backup (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  table_name text NOT NULL,
  row_id text NOT NULL,
  payload jsonb NOT NULL,
  backed_up_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.g1_migrate_backup ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS g1_migrate_backup_own ON public.g1_migrate_backup;
CREATE POLICY g1_migrate_backup_own ON public.g1_migrate_backup
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT ON public.g1_migrate_backup TO authenticated;

SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('sessions', 'reviews', 'app_state')
  AND column_name IN ('updated_at', 'deleted_at')
ORDER BY table_name, column_name;

SELECT tgrelid::regclass AS tbl, tgname
FROM pg_trigger
WHERE NOT tgisinternal AND tgname LIKE 'trg_%_stamp'
ORDER BY 1;
