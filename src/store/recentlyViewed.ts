import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const MAX = 8

interface RecentlyViewedState {
  ids: string[]
  track: (id: string) => void
  clear: () => void
}

export const useRecentlyViewed = create<RecentlyViewedState>()(
  persist(
    (set) => ({
      ids: [],
      track: (id) =>
        set((s) => {
          const next = [id, ...s.ids.filter((x) => x !== id)].slice(0, MAX)
          return { ids: next }
        }),
      clear: () => set({ ids: [] }),
    }),
    { name: 'inkcredible-recently-viewed' },
  ),
)
