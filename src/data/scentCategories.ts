export const SCENT_CATEGORIES: Record<string, string[]> = {
  "Fall · Cozy · Spooky": [
    "Pumpkin Pecan Waffles",
    "Maple Pecan Waffles",
    "Leaves",
    "Marshmallow Fireside",
    "Pumpkin Spice",
    "Pumpkin Caramel Crunch",
    "Pumpkin Spice Cake",
    "Haunted Woods",
    "Witches Brew",
    "Brown Sugar Fig",
    "Harvest Moon",
    "Caramel Apple",
    "Ghost Story",
    "Luna",
    "Fireside"
  ],
  "Masculine": [
    "50 Shades of Gray",
    "Tobacco Vanilla",
    "Sauvage Dior",
    "Huntsman",
    "Acqua Di Gio",
    "Leather"
  ],
  "Women’s Perfume": [
    "Pink Sugar",
    "Endless Weekend",
    "White Diamonds",
    "Yum Boujee Marshmallow"
  ],
  "Desserts · Sweets · Fruity": [
    "Snickerdoodle",
    "Strawberry Pound Cake",
    "Cotton Candy",
    "Juicy Fruit Gum",
    "Iced Cinnamon Rolls",
    "Blueberry Cheesecake",
    "Atomic Cherry",
    "Cherry Bomb",
    "French Vanilla Latte",
    "Coffee Latte",
    "Banana Nut Bread",
    "Froot Loops",
    "Sugar Cookie"
  ],
  "Floral": [
    "Sweet Jasmine"
  ],
  "Woods · Earthy": [
    "Balsam",
    "Fraser Fir",
    "Cedarwood Amber",
    "Nag Champa",
    "Iced Vanilla Woods"
  ],
  "Fresh · Clean · Other Favorites": [
    "Summer Nights",
    "Black Ice",
    "Cocoa Butter Cashmere",
    "Ocean",
    "Pink Sands"
  ]
}

export function groupScents(scents: string[]): [string, string[]][] {
  const matched = new Set<string>()
  const groups: [string, string[]][] = Object.entries(SCENT_CATEGORIES).map(([category, names]) => {
    const members = scents.filter((s) => names.some((name) => name.toLowerCase() === s.toLowerCase()))
    members.forEach((s) => matched.add(s))
    return [category, members] as [string, string[]]
  }).filter(([, members]) => members.length > 0)
  const other = scents.filter((s) => !matched.has(s))
  if (other.length) groups.push(['More scents', other])
  return groups
}
