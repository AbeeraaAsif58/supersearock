import type { NavigateFunction } from "react-router-dom";

let navigateRef: NavigateFunction | null = null;

export function setAppNavigate(navigate: NavigateFunction) {
  navigateRef = navigate;
}

export function appRedirect(to: string) {
  if (navigateRef) {
    navigateRef(to);
    return;
  }

  if (typeof window !== "undefined") {
    window.location.href = to;
  }
}
