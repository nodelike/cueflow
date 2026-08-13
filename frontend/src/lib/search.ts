/** Search should follow how people remember a title, not how punctuation was
 *  stored by the distributor. This folds Don't, DON’T, and dont to the same
 *  value, and also makes accents, separators, and extra spaces irrelevant. */
export function fold(value: string) {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

export function matches(haystack: string, query: string) {
  const needle = fold(query)
  return !needle || fold(haystack).includes(needle)
}
