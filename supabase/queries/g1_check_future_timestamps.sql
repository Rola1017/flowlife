-- 用途：查 sessions／reviews／app_state 的 updated_at > now() 筆數
--       （判斷是否需要 G1 搬家壓回未來時間戳）
-- 類型：只讀診斷（不改資料、不改 schema）
-- 執行日期：2026-09-25
-- 結果（2026-09-25）：三表皆為 0，故退役搬家程式

SELECT 'sessions' AS tbl, count(*) AS future_updated
FROM public.sessions
WHERE updated_at > now()
UNION ALL
SELECT 'reviews', count(*)
FROM public.reviews
WHERE updated_at > now()
UNION ALL
SELECT 'app_state', count(*)
FROM public.app_state
WHERE updated_at > now();
