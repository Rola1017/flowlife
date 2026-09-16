-- FlowLife Z1：sessions 新增 tag_ids（text[]）
-- 既有 sessions RLS 以 user_id = auth.uid() 列層級控管，新欄位自動涵蓋，不需新增 policy。
-- （記取 /api/today 的 GRANT 血淚：那是 service_role 讀 app_state 的例外；sessions 由使用者自己的 RLS 覆蓋整列。）

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS tag_ids text[];
