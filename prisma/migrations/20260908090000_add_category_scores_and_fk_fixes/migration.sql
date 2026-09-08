-- Добавляем недостающую колонку categoryScores в DIAuditResult.
-- Ранее поле было добавлено в schema.prisma без миграции, из-за чего runtime
-- падал с ошибкой Prisma P2022 (колонка отсутствует в БД) при чтении аудита
-- и в ленте активности (activity-feed).
ALTER TABLE "DIAuditResult" ADD COLUMN IF NOT EXISTS "categoryScores" TEXT NOT NULL DEFAULT '{}';

-- Приводим внешние ключи в соответствие со schema.prisma:
-- 1) PromptChainRunResult.positionId больше не является FK на Position
--    (запись результата должна сохраняться даже при удалении/пересоздании должности).
ALTER TABLE "PromptChainRunResult" DROP CONSTRAINT IF EXISTS "PromptChainRunResult_positionId_fkey";

-- 2) StaffingTable.positionId должен иметь FK с ON DELETE SET NULL
--    (referential integrity привязки строки ШР к созданной должности).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StaffingTable_positionId_fkey'
  ) THEN
    ALTER TABLE "StaffingTable"
      ADD CONSTRAINT "StaffingTable_positionId_fkey"
      FOREIGN KEY ("positionId") REFERENCES "Position"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
