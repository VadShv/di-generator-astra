// Система прав доступа к вкладкам приложения.
// permissions хранится как JSON на User: {"tab-id": "read"|"write"|"none"}
// null = полный доступ (admin). Роль 'kdp' = предустановленный набор.

export type AccessLevel = 'read' | 'write' | 'none'
export type Permissions = Record<string, AccessLevel>

// Все вкладки приложения, к которым можно настроить доступ
export const ALL_TABS = [
  'dashboard',
  'staff-schedule',
  'dictionaries',
  'archive',
  'templates',
  'master-prompts',
  'ai-providers',
  'generation',
  'mass-generation',
  'tracking',
  'version-history',
  'ai-audit',
  'instructions',
  'tech-stack',
  'profile',
] as const

// Полный доступ (для admin)
export const ALL_WRITE: Permissions = Object.fromEntries(
  ALL_TABS.map((tab) => [tab, 'write' as AccessLevel])
)

// Preset для роли 'kdp' (Специалист по КДП)
// Настройки (ИИ-провайдеры, мастер-промпты) — только чтение
// Генерация, аудит, отслеживание — полный доступ
export const KDP_PRESET: Permissions = {
  dashboard: 'read',
  'staff-schedule': 'write',
  dictionaries: 'read',
  archive: 'read',
  templates: 'read',
  'master-prompts': 'read',
  'ai-providers': 'read',
  generation: 'write',
  'mass-generation': 'write',
  tracking: 'write',
  'version-history': 'read',
  'ai-audit': 'write',
  instructions: 'read',
  'tech-stack': 'read',
  profile: 'write',
}

// Preset для роли 'user' (минимальный доступ)
export const USER_PRESET: Permissions = {
  dashboard: 'read',
  'staff-schedule': 'read',
  dictionaries: 'none',
  archive: 'read',
  templates: 'read',
  'master-prompts': 'none',
  'ai-providers': 'none',
  generation: 'write',
  'mass-generation': 'none',
  tracking: 'read',
  'version-history': 'read',
  'ai-audit': 'none',
  instructions: 'read',
  'tech-stack': 'read',
  profile: 'write',
}

// Получить preset по роли
export function getPresetForRole(role: string): Permissions {
  if (role === 'admin') return ALL_WRITE
  if (role === 'kdp') return KDP_PRESET
  return USER_PRESET
}

// Распарсить permissions из JSON-строки
export function parsePermissions(role: string, permissionsJson: string | null): Permissions {
  if (role === 'admin') return ALL_WRITE
  if (!permissionsJson) return getPresetForRole(role)
  try {
    const parsed = JSON.parse(permissionsJson) as Permissions
    // Дополняем недостающие вкладки значением 'none'
    const result: Permissions = {}
    for (const tab of ALL_TABS) {
      result[tab] = parsed[tab] ?? 'none'
    }
    return result
  } catch {
    return getPresetForRole(role)
  }
}

// Проверить доступ к вкладке
export function hasAccess(
  permissions: Permissions | null | undefined,
  tab: string,
  level: AccessLevel = 'read'
): boolean {
  // null/undefined permissions = полный доступ ТОЛЬКО для admin.
  // Fail-closed: при отключённой аутентификации requirePermission() возвращает null
  // (не вызывает hasAccess), поэтому сюда null доходит только от admin-сессии.
  if (!permissions) return true
  const tabPerm = permissions[tab]
  if (!tabPerm || tabPerm === 'none') return false
  if (level === 'write') return tabPerm === 'write'
  return true // read или write
}

/**
 * Безопасная проверка доступа с учётом состояния аутентификации (fail-closed).
 * Возвращает false, если аутентификация включена, но permissions отсутствуют и это не admin.
 * Возвращает true только для admin (role === 'admin') или при отключённой аутентификации.
 *
 * @param permissions — матрица прав из сессии
 * @param tab — id вкладки
 * @param level — требуемый уровень
 * @param role — роль пользователя (для определения admin без матрицы)
 * @param authDisabled — признак отключённой аутентификации (только для dev)
 */
export function hasAccessSafe(
  permissions: Permissions | null | undefined,
  tab: string,
  level: AccessLevel = 'read',
  role?: string,
  authDisabled = false
): boolean {
  // Отключённая аутентификация (dev-only) — открытый доступ.
  if (authDisabled) return true
  // Admin без явной матрицы прав — полный доступ.
  if (!permissions && role === 'admin') return true
  // Fail-closed: аутентификация включена, но permissions отсутствуют и это не admin.
  if (!permissions) return false
  const tabPerm = permissions[tab]
  if (!tabPerm || tabPerm === 'none') return false
  if (level === 'write') return tabPerm === 'write'
  return true // read или write
}
