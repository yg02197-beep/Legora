export function authorize(token: string): boolean {
  return token.length > 0;
}
