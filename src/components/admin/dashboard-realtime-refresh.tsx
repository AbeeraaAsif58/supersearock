"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type DashboardRealtimeRefreshProps = {
  onRefresh?: () => void;
};

export function DashboardRealtimeRefresh({ onRefresh }: DashboardRealtimeRefreshProps) {
  useEffect(() => {
    const supabase = createClient();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        onRefresh?.();
      }, 600);
    };

    const channel = supabase
      .channel("admin-dashboard-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "follow_up_tasks" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [onRefresh]);

  return null;
}
