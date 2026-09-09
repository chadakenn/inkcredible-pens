import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  ScentsApiError,
  clearScentsApi,
  createScent,
  deleteScent,
  fetchScents,
  renameScentApi,
  resetScentsApi,
  type ScentsSyncState,
} from '../lib/scentsApi'

// Starter scents — server seed is authoritative; this is offline/cache fallback only.
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
  syncState: ScentsSyncState
  syncError: string | null
  hydrateFromApi: () => Promise<void>
  addScent: (name: string) => Promise<boolean>
  removeScent: (name: string) => Promise<void>
  clearScents: () => Promise<void>
  renameScent: (from: string, to: string) => Promise<boolean>
  resetToDefaults: () => Promise<void>
}

function normalize(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

function mutationErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ScentsApiError) {
    if (err.status === 0 || err.message.includes('Failed to fetch')) {
      return 'Scents server unavailable — try again when online.'
    }
    if (err.status === 401 || err.status === 403) {
      return 'Admin login required to change scents.'
    }
    return err.message || fallback
  }
  if (err instanceof TypeError) {
    return 'Scents server unavailable — try again when online.'
  }
  if (err instanceof Error && err.message) return err.message
  return fallback
}

export const useScents = create<ScentsState>()(
  persist(
    (set, get) => ({
      scents: [...DEFAULT_SCENTS],
      syncState: 'idle',
      syncError: null,

      hydrateFromApi: async () => {
        set({ syncState: 'loading', syncError: null })
        try {
          const remote = await fetchScents()
          set({
            scents: remote,
            syncState: 'synced',
            syncError: null,
          })
        } catch (err) {
          const message = mutationErrorMessage(err, 'sync_failed')
          // Keep cached scents; mark offline — cache is not source of truth
          set({ syncState: 'error', syncError: message })
        }
      },

      addScent: async (name) => {
        const next = normalize(name)
        if (!next) return false
        try {
          const scents = await createScent(next)
          set({ scents, syncState: 'synced', syncError: null })
          return true
        } catch (err) {
          if (err instanceof ScentsApiError && err.code === 'duplicate_scent') {
            return false
          }
          const message = mutationErrorMessage(err, 'Could not add scent on server.')
          set({ syncState: 'error', syncError: message })
          throw new Error(message)
        }
      },

      removeScent: async (name) => {
        try {
          const scents = await deleteScent(name)
          set({ scents, syncState: 'synced', syncError: null })
        } catch (err) {
          const message = mutationErrorMessage(err, 'Could not remove scent on server.')
          set({ syncState: 'error', syncError: message })
          throw new Error(message)
        }
      },

      clearScents: async () => {
        try {
          const scents = await clearScentsApi()
          set({ scents, syncState: 'synced', syncError: null })
        } catch (err) {
          const message = mutationErrorMessage(err, 'Could not clear scents on server.')
          set({ syncState: 'error', syncError: message })
          throw new Error(message)
        }
      },

      renameScent: async (from, to) => {
        const next = normalize(to)
        if (!next) return false
        if (!get().scents.includes(from)) return false
        try {
          const scents = await renameScentApi(from, next)
          set({ scents, syncState: 'synced', syncError: null })
          return true
        } catch (err) {
          if (
            err instanceof ScentsApiError &&
            (err.code === 'duplicate_scent' || err.code === 'invalid_rename')
          ) {
            return false
          }
          const message = mutationErrorMessage(err, 'Could not rename scent on server.')
          set({ syncState: 'error', syncError: message })
          throw new Error(message)
        }
      },

      resetToDefaults: async () => {
        try {
          const scents = await resetScentsApi()
          set({ scents, syncState: 'synced', syncError: null })
        } catch (err) {
          const message = mutationErrorMessage(err, 'Could not reset scents on server.')
          set({ syncState: 'error', syncError: message })
          throw new Error(message)
        }
      },
    }),
    {
      name: 'inkcredible-freshie-scents',
      version: 2,
      partialize: (state) => ({ scents: state.scents }),
    },
  ),
)
