/** Gaming platforms — values use IGDB abbreviation format for system-wide consistency */
export const PLATFORMS = [
  { value: 'PC', label: 'PC (Windows)' },
  { value: 'Mac', label: 'Mac' },
  { value: 'Linux', label: 'Linux' },
  { value: 'PS5', label: 'PlayStation 5' },
  { value: 'PS4', label: 'PlayStation 4' },
  { value: 'Series X|S', label: 'Xbox Series X|S' },
  { value: 'XONE', label: 'Xbox One' },
  { value: 'Switch', label: 'Nintendo Switch' },
  { value: 'Switch 2', label: 'Nintendo Switch 2' },
  { value: 'Android', label: 'Android' },
  { value: 'iOS', label: 'iOS' },
] as const

/** Subscription services — slugs are the system-wide standard, will map to future `services` table */
export const SUBSCRIPTION_SERVICES = [
  { value: 'gamepass-core', label: 'Xbox Game Pass Core' },
  { value: 'gamepass-standard', label: 'Xbox Game Pass Standard' },
  { value: 'gamepass-ultimate', label: 'Xbox Game Pass Ultimate' },
  { value: 'ps-plus-essential', label: 'PS Plus Essential' },
  { value: 'ps-plus-extra', label: 'PS Plus Extra' },
  { value: 'ps-plus-premium', label: 'PS Plus Premium' },
  { value: 'ea-play', label: 'EA Play' },
  { value: 'ea-play-pro', label: 'EA Play Pro' },
  { value: 'ubisoft-plus', label: 'Ubisoft+ Classics' },
  { value: 'ubisoft-plus-premium', label: 'Ubisoft+ Premium' },
  { value: 'nintendo-online', label: 'Nintendo Switch Online' },
  { value: 'nintendo-online-expansion', label: 'Nintendo Switch Online + Expansion Pack' },
  { value: 'humble-choice', label: 'Humble Choice' },
  { value: 'geforce-now', label: 'GeForce NOW' },
  { value: 'amazon-luna', label: 'Amazon Luna' },
] as const
