export function charge(cents: number): number {
  return Math.max(0, cents);
}
