/**
 * Render a deterministic 5x5 mirrored "GitHub-style" identicon for a seed
 * (typically a user's name or id) as a base64-encoded SVG data URL.
 *
 * 32-bit djb2 hash → first 15 bits drive the 3-column-by-5-row grid;
 * the rightmost column mirrors the leftmost so the output is always
 * left-right symmetric. The next byte picks a foreground colour from
 * a brand palette, producing the chunky 8-bit look.
 */

const PALETTE = [
  '#3e79ff', // primary blue
  '#ff4968', // secondary pink
  '#00c950', // success green
  '#e17100', // warning amber
  '#0084d1', // info cyan
  '#fb2c36', // danger red
  '#7c3aed', // violet
  '#0d9488', // teal
  '#65a30d', // olive
  '#ea580c', // orange
  '#0891b2', // sky
  '#be185d', // magenta
] as const

const BACKGROUND = '#e4e4e7'

function djb2(input: string): number {
  let hash = 5381
  for (const char of input) {
    // (hash * 33) ^ codepoint — coerced to unsigned 32-bit
    hash = ((hash * 33) ^ (char.codePointAt(0) ?? 0)) >>> 0
  }
  return hash >>> 0
}

const encodeBase64 = (raw: string): string => {
  if (typeof globalThis.btoa === 'function') return globalThis.btoa(raw)
  // Node fallback — keeps the helper testable in node environments.
  return Buffer.from(raw, 'binary').toString('base64')
}

export function generateIdenticon(seed: string, size: number = 96): string {
  const safeSeed = seed.trim() || 'anonymous'
  const hash = djb2(safeSeed)
  const fg = PALETTE[hash % PALETTE.length]

  const cells: string[] = []
  // 3 logical columns × 5 rows = 15 bits. Columns 0/1 mirror onto 4/3.
  const cell = 20 // viewBox is 100×100 → 5 cells of 20 each
  for (let y = 0; y < 5; y += 1) {
    for (let x = 0; x < 3; x += 1) {
      const bit = (hash >>> (y * 3 + x)) & 1
      if (!bit) continue
      cells.push(
        `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}"/>`,
      )
      if (x < 2) {
        cells.push(
          `<rect x="${(4 - x) * cell}" y="${y * cell}" width="${cell}" height="${cell}"/>`,
        )
      }
    }
  }

  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" ' +
    `width="${size}" height="${size}" shape-rendering="crispEdges">` +
    `<rect width="100" height="100" fill="${BACKGROUND}"/>` +
    `<g fill="${fg}">${cells.join('')}</g>` +
    '</svg>'

  return `data:image/svg+xml;base64,${encodeBase64(svg)}`
}
