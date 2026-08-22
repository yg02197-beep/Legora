export function routeRequest(path: string): "auth" | "billing" {
  return path.startsWith("/auth") ? "auth" : "billing";
}
