-- 用途：確認 sessions／reviews 已有 deleted_at 欄位（G1 軟刪 schema）
-- 類型：只讀診斷（不改資料、不改 schema）
-- 執行日期：2026-09-25

SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('sessions', 'reviews', 'app_state')
  AND column_name IN ('deleted_at', 'updated_at')
ORDER BY table_name, column_name;
