import { useEffect } from 'react'

const SUFFIX = 'Inkcredible Pens'

/** Sets document.title; restores a generic fallback on unmount. */
export function useDocumentTitle(title: string | undefined | null) {
  useEffect(() => {
    const prev = document.title
    document.title = title?.trim()
      ? title.includes(SUFFIX)
        ? title
        : `${title} · ${SUFFIX}`
      : SUFFIX
    return () => {
      document.title = prev
    }
  }, [title])
}
