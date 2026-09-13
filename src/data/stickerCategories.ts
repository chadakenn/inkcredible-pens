import type { Product } from './products'

export const STICKER_CATEGORIES = [
  'Funny & Sarcastic',
  'Mental Health & Self-Care',
  'ADHD & Neurospicy',
  'Faith & Encouragement',
  'Animals & Critters',
  'Work & Adulting',
  'Witchy & Spooky',
  'More stickers',
] as const

export type StickerCategory = (typeof STICKER_CATEGORIES)[number]

// Existing products have no sticker tags. These suggestions keep the old catalog
// browsable until a manager reviews and saves each product's category choices.
export function suggestStickerCategories(product: Pick<Product, 'name' | 'tagline' | 'description'>): StickerCategory[] {
  const text = product.name.toLowerCase()
  const matches: StickerCategory[] = []
  const add = (category: StickerCategory, pattern: RegExp) => { if (pattern.test(text)) matches.push(category) }
  add('Mental Health & Self-Care', /anxiet|mental|therapy|therapist|trauma|healing|depress|stress|burn.?out|boundary|boundaries|self.care|medication|meds|serotonin|zoloft|lexapro|fluoxetine|sertraline|panic|overthink|nervous|emotion|saddie|fatigue|overstimulat|intrusive thought|rest your|you are enough|you don't have to earn rest|bipolar|bpd|ocd|mood|surviv|struggle|spiral|exhaust/)
  add('ADHD & Neurospicy', /adhd|neuro|autis|tism|executive dysfunction|dopamine|distract|side quest|procrastinat|too many tabs|rabbit hole|impulsive/)
  add('Faith & Encouragement', /jesus|christ|god |the lord|prayer|pray|psalm|proverb|faith|forgiven|bless|heaven|grace|amen|scripture|mercy|hope|you are enough|you really rock|keep going|don't give up/)
  add('Animals & Critters', /\bcat\b|\bdog\b|\bfrog\b|raccoon|goose|opossum|unicorn|\bduck\b|\bbat\b|\bbird\b|\bbunny\b|\bfox\b|dino|squirrel|panda|llama|chick|pecker/)
  add('Work & Adulting', /\bwork\b|job|boss|employee|coworker|email|paycheck|bill|adulting|grown.up|spreadsheet|password|coffee|caffein|meeting|weekend|retirement|money|amazon|order|weld|jobsite|busy|to.do|procrastinat/)
  add('Witchy & Spooky', /witch|spooky|ghost|skeleton|voodoo|magic|halloween|haunt|coffin|spirit|smudge|scare|spell|broom|skull|grave|dark humor/)
  add('Funny & Sarcastic', /fk|fuck|shit|bitch|ass|sarcas|funny|joke|wtf|unhinged|chaos|hot mess|bull|prick|silly|trash|shenanigan|no f|freakin|hell|delulu|don't care|don't give|rude|petty|dramatic|damn|sarcastic/)
  return matches.length ? matches : ['More stickers']
}

export function stickerCategories(product: Product): StickerCategory[] {
  return product.stickerCategories?.length ? product.stickerCategories : suggestStickerCategories(product)
}

// Text-only check: managers can correct the flag after inspecting the artwork.
export function stickerHasNoCussWords(product: Product): boolean {
  if (product.stickerClean !== undefined) return product.stickerClean
  return false
}
