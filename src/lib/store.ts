import { create } from 'zustand'

export type ActiveSection = 
 | 'dashboard' | 'staff-schedule' | 'dictionaries' | 'archive' | 'templates'
 | 'master-prompts' | 'generation' | 'tracking'
 | 'mass-generation' | 'ai-audit' | 'version-history' | 'instructions'
  | 'ai-providers' | 'tech-stack'

interface AppState {
  activeSection: ActiveSection
  setActiveSection: (section: ActiveSection) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeSection: 'dashboard',
  setActiveSection: (section) => set({ activeSection: section }),
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))
