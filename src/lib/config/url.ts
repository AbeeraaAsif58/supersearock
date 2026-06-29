export function getSiteUrl() {
  const envUrl = import.meta.env.VITE_SITE_URL;
  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "http://localhost:5173";
}
