import { create } from 'zustand'

export type ActiveSection = 
  | 'dashboard'
  | 'staff-schedule'
  | 'archive'
  | 'templates'
  | 'master-prompts'
  | 'generation'
  | 'tracking'
  | 'comparison'

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
