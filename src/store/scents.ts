import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Starter scents — replace with what’s in stock.
export const DEFAULT_SCENTS = [
  'Vanilla Bean',
  'Lavender',
  'Citrus Hustle',
  'Fresh Linen',
  'Black Ice',
  'Strawberry',
  'Coconut',
  'New Car',
  'Midnight Cherry',
  'Ocean Breeze',
] as const

interface ScentsState {
  scents: string[]
  addScent: (name: string) => boolean
  removeScent: (name: string) => void
  clearScents: () => void
  renameScent: (from: string, to: string) => boolean
  resetToDefaults: () => void
}

function normalize(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

export const useScents = create<ScentsState>()(
  persist(
    (set, get) => ({
      scents: [...DEFAULT_SCENTS],
      addScent: (name) => {
        const next = normalize(name)
        if (!next) return false
        const exists = get().scents.some(
          (s) => s.toLowerCase() === next.toLowerCase(),
        )
        if (exists) return false
        set((s) => ({ scents: [...s.scents, next] }))
        return true
      },
      removeScent: (name) =>
        set((s) => ({ scents: s.scents.filter((x) => x !== name) })),
      clearScents: () => set({ scents: [] }),
      renameScent: (from, to) => {
        const next = normalize(to)
        if (!next) return false
        const list = get().scents
        if (!list.includes(from)) return false
        const clash = list.some(
          (s) => s !== from && s.toLowerCase() === next.toLowerCase(),
        )
        if (clash) return false
        set({
          scents: list.map((s) => (s === from ? next : s)),
        })
        return true
      },
      resetToDefaults: () => set({ scents: [...DEFAULT_SCENTS] }),
    }),
    { name: 'inkcredible-freshie-scents' },
  ),
)
