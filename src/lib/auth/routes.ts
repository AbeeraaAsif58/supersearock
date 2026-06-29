import type { Profile } from "@/lib/auth/types";

export function getAppHomePath(profile: Pick<Profile, "role" | "is_primary_admin">) {
  if (profile.role === "admin" && profile.is_primary_admin) {
    return "/admin/dashboard";
  }
  return "/dashboard";
}
