-- Полнотекстовый поиск: GIN-индексы на tsvector-выражениях.
-- Запуск: psql -d di_generator -f prisma/sql/001_fulltext_search.sql
-- или: bunx prisma db execute --file prisma/sql/001_fulltext_search.sql

-- GIN-индекс для полнотекстового поиска по содержимому архивных ДИ.
-- to_tsvector('russian', ...) — морфологический поиск с поддержкой русского языка.
CREATE INDEX IF NOT EXISTS "ArchiveDI_content_fts_idx"
  ON "ArchiveDI"
  USING gin (to_tsvector('russian', content));

-- GIN-индекс для поиска по заголовкам сгенерированных ДИ.
CREATE INDEX IF NOT EXISTS "GeneratedDI_title_fts_idx"
  ON "GeneratedDI"
  USING gin (to_tsvector('russian', title));

-- pg_trgm для ILIKE-поиска по коротким полям (title, fileName, name).
-- Триграммы ускоряют contains/ILIKE '%...%' на коротких строках.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "ArchiveDI_title_trgm_idx"
  ON "ArchiveDI" USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "ArchiveDI_fileName_trgm_idx"
  ON "ArchiveDI" USING gin ("fileName" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "GeneratedDI_title_trgm_idx"
  ON "GeneratedDI" USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Position_title_trgm_idx"
  ON "Position" USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Department_name_trgm_idx"
  ON "Department" USING gin (name gin_trgm_ops);
