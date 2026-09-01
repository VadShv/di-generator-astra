import { create } from 'zustand'

export type ActiveSection =
 | 'dashboard' | 'staff-schedule' | 'dictionaries' | 'archive' | 'templates'
 | 'master-prompts' | 'generation' | 'tracking'
 | 'mass-generation' | 'ai-audit' | 'version-history' | 'instructions'
 | 'ai-providers' | 'tech-stack' | 'profile'

// Контекст навигации: позволяет передать ID сущности при переходе между модулями.
// Например: navigateTo('generation', { positionId }) — открыть генерацию с выбранной должностью.
export interface NavigationContext {
  positionId?: string
  diId?: string
  archiveId?: string
  jobId?: string
  companyId?: string
  departmentId?: string
}

interface AppState {
  activeSection: ActiveSection
  setActiveSection: (section: ActiveSection) => void
  // Контекст последней навигации (ID сущности). Сбрасывается в undefined после применения модулем.
  navigationContext: NavigationContext | undefined
  // Навигация с контекстом: переключает секцию и передаёт ID сущности.
  navigateTo: (section: ActiveSection, context?: NavigationContext) => void
  // Сброс контекста (вызывается модулем после применения).
  clearNavigationContext: () => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeSection: 'dashboard',
  setActiveSection: (section) => set({ activeSection: section }),
  navigationContext: undefined,
  navigateTo: (section, context) => set({ activeSection: section, navigationContext: context }),
  clearNavigationContext: () => set({ navigationContext: undefined }),
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))
