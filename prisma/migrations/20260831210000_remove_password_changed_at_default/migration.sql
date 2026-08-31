-- Убираем DEFAULT CURRENT_TIMESTAMP у passwordChangedAt.
-- Колонка добавлена миграцией phase6_security_hardening с DEFAULT,
-- что ошибочно помечало все существующие сессии как устаревшие
-- (passwordChangedAt > token.issuedAt → отзыв сессии).
-- Теперь passwordChangedAt = NULL при создании пользователя,
-- и устанавливается только при смене пароля (change-password route).
ALTER TABLE "User" ALTER COLUMN "passwordChangedAt" DROP DEFAULT;
