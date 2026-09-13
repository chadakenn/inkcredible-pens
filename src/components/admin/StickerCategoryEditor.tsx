import { STICKER_CATEGORIES, type StickerCategory } from '../../data/stickerCategories'

export default function StickerCategoryEditor({ value, onChange, clean, onCleanChange }: {
  value: StickerCategory[]
  onChange: (value: StickerCategory[]) => void
  clean: boolean
  onCleanChange: (value: boolean) => void
}) {
  return <fieldset className="rounded-2xl border border-line bg-ink p-4">
    <legend className="px-2 text-sm font-extrabold uppercase tracking-wide text-pink">Sticker categories</legend>
    <p className="mb-3 text-sm text-mute">Choose every section where this design belongs. Check the artwork before marking it clean.</p>
    <div className="grid gap-2 sm:grid-cols-2">
      {STICKER_CATEGORIES.map(category => <label key={category} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line bg-ink-2 px-3 text-sm font-bold text-cream">
        <input type="checkbox" checked={value.includes(category)} onChange={() => onChange(value.includes(category) ? value.filter(x => x !== category) : [...value, category])} className="h-5 w-5 accent-pink" />{category}
      </label>)}
    </div>
    <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line bg-ink-2 px-3 text-sm font-bold text-cream">
      <input type="checkbox" checked={clean} onChange={e => onCleanChange(e.target.checked)} className="h-5 w-5 accent-pink" />No cuss words in text or artwork
    </label>
  </fieldset>
}
