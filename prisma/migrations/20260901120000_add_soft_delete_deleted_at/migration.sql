-- Фаза 7.22: Soft-delete для User, GeneratedDI, ArchiveDI.
-- Поле deletedAt (nullable): null = активная запись, дата = мягко удалена.
-- Prisma client extension автоматически фильтрует deletedAt: null в find-запросах
-- и перехватывает delete → update deletedAt.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "GeneratedDI" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "ArchiveDI" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");
CREATE INDEX "GeneratedDI_deletedAt_idx" ON "GeneratedDI"("deletedAt");
CREATE INDEX "ArchiveDI_deletedAt_idx" ON "ArchiveDI"("deletedAt");

-- Фаза 8.4: Unique constraint для DIVersion — предотвращает дубликаты версий
-- (generatedDIId, version) при параллельном создании.
CREATE UNIQUE INDEX "DIVersion_generatedDIId_version_key" ON "DIVersion"("generatedDIId", "version");
