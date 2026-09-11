-- FlowLife：app_state 加 service_role 唯讀 RLS（最小權限）
-- 請 Rola 在 Supabase → SQL Editor 整段執行
-- 安全邊界：只 SELECT、只 app_state、只 TO service_role；不改既有 policy

-- ① 現況：列出 app_state 既有 policy（執行後把結果貼回對話）
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'app_state'
ORDER BY policyname;

-- ② 確認 RLS 已啟用（relrowsecurity = true）
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'app_state';

-- ③ 新增唯讀 policy（若已存在會報錯；可先 DROP 再 CREATE，或略過）
-- DROP POLICY IF EXISTS "service_role read app_state" ON public.app_state;
CREATE POLICY "service_role read app_state"
  ON public.app_state
  FOR SELECT
  TO service_role
  USING (true);

-- ④ 驗收：確認新 policy 存在，且 cmd=SELECT、roles 含 service_role
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename = 'app_state'
ORDER BY policyname;

-- ⑤ 確認沒有把 INSERT/UPDATE/DELETE 授給 service_role（本批只要 SELECT）
SELECT policyname, roles, cmd
FROM pg_policies
WHERE tablename = 'app_state'
  AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  AND 'service_role' = ANY (roles);

-- ⑥ 確認其他表沒有剛加的同名／類似 policy（應為 0 列）
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE policyname = 'service_role read app_state'
  AND tablename <> 'app_state';
