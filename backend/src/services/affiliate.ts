/**
 * Affiliate link builder.
 *
 * Wraps store URLs with affiliate tracking codes when configured.
 * Add affiliate codes to .env:
 *   AFFILIATE_HUMBLE=your_tracking_id
 *   AFFILIATE_GOG=your_tracking_id
 *   AFFILIATE_GMG=your_tracking_id
 *   AFFILIATE_XBOX=your_impact_id
 *   AFFILIATE_PLAYSTATION=your_partnerize_id
 *
 * When no code is configured for a store, the direct URL is returned.
 */

const affiliateCodes: Record<string, string | undefined> = {
  humble: process.env.AFFILIATE_HUMBLE,
  gog: process.env.AFFILIATE_GOG,
  gmg: process.env.AFFILIATE_GMG,
  xbox: process.env.AFFILIATE_XBOX,
  playstation: process.env.AFFILIATE_PLAYSTATION,
  fanatical: process.env.AFFILIATE_FANATICAL,
  epic: process.env.AFFILIATE_EPIC,
}

export function buildAffiliateUrl(store: string, directUrl: string): string {
  const code = affiliateCodes[store]
  if (!code) return directUrl

  // Each store has its own affiliate URL format
  switch (store) {
    case 'humble':
      // Humble uses partner param
      return `${directUrl}${directUrl.includes('?') ? '&' : '?'}partner=${code}`
    case 'gog':
      // GOG uses pp param via AdTraction
      return `${directUrl}${directUrl.includes('?') ? '&' : '?'}pp=${code}`
    case 'gmg':
      // GMG typically uses a tracking subdomain or param
      return `${directUrl}${directUrl.includes('?') ? '&' : '?'}tap_a=${code}`
    case 'xbox':
      // Xbox/Microsoft uses Impact Radius tracking
      return `https://click.linksynergy.com/deeplink?id=${code}&mid=24542&murl=${encodeURIComponent(directUrl)}`
    case 'fanatical':
      // Fanatical via CJ
      return `${directUrl}${directUrl.includes('?') ? '&' : '?'}ref=${code}`
    case 'epic':
      // Epic Support-A-Creator
      return `${directUrl}${directUrl.includes('?') ? '&' : '?'}creator=${code}`
    default:
      return directUrl
  }
}
