let count = 0

export const popoverRegistry = {
  add() {
    count += 1
  },
  remove() {
    if (count > 0) count -= 1
  },
  size() {
    return count
  },
}
