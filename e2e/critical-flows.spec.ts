import { test, expect } from '@playwright/test'

// E2E: Логин → навигация → глобальный поиск
// Требует: запущенный dev-сервер на :3001, БД с admin-пользователем

test.describe('Критичные flow', () => {
  test('Логин admin', async ({ page }) => {
    await page.goto('/login')

    // Проверяем что форма логина видна
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()

    // Заполняем и отправляем
    await page.fill('input[type="email"]', 'admin@astra.ru')
    await page.fill('input[type="password"]', 'admin12345')
    await page.click('button[type="submit"]')

    // Ждём редирект на главную
    await page.waitForURL('/', { timeout: 10000 })

    // Проверяем что навигация видна
    await expect(page.locator('text=Дашборд')).toBeVisible()
    await expect(page.locator('text=Штатное расписание')).toBeVisible()
  })

  test('Навигация по вкладкам', async ({ page }) => {
    // Логин
    await page.goto('/login')
    await page.fill('input[type="email"]', 'admin@astra.ru')
    await page.fill('input[type="password"]', 'admin12345')
    await page.click('button[type="submit"]')
    await page.waitForURL('/', { timeout: 10000 })

    // Кликаем по вкладкам
    const tabs = ['Штатное расписание', 'Справочники', 'ИИ-провайдеры', 'Личный кабинет']
    for (const tab of tabs) {
      await page.click(`text=${tab}`)
      await page.waitForTimeout(500) // даём время на lazy-load
      // Проверяем что контент загрузился (не пустая страница)
      const content = await page.locator('main').textContent()
      expect(content?.length).toBeGreaterThan(0)
    }
  })

  test('Глобальный поиск Ctrl+K', async ({ page }) => {
    // Логин
    await page.goto('/login')
    await page.fill('input[type="email"]', 'admin@astra.ru')
    await page.fill('input[type="password"]', 'admin12345')
    await page.click('button[type="submit"]')
    await page.waitForURL('/', { timeout: 10000 })

    // Открываем поиск через Ctrl+K
    await page.keyboard.press('Control+k')

    // Проверяем что модалка поиска открылась
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 3000 })
    await expect(page.locator('input[placeholder*="Поиск"]')).toBeVisible()

    // Закрываем через Escape
    await page.keyboard.press('Escape')
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 3000 })
  })

  test('Личный кабинет — смена пароля', async ({ page }) => {
    // Логин
    await page.goto('/login')
    await page.fill('input[type="email"]', 'admin@astra.ru')
    await page.fill('input[type="password"]', 'admin12345')
    await page.click('button[type="submit"]')
    await page.waitForURL('/', { timeout: 10000 })

    // Переходим в ЛК
    await page.click('text=Личный кабинет')
    await page.waitForTimeout(500)

    // Проверяем что форма смены пароля видна
    await expect(page.locator('text=Смена пароля')).toBeVisible({ timeout: 5000 })
  })
})
