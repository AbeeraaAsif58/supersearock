"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type AgentRealtimeRefreshProps = {
  agentId: string;
  onRefresh?: () => void;
};

export function AgentRealtimeRefresh({ agentId, onRefresh }: AgentRealtimeRefreshProps) {
  useEffect(() => {
    const supabase = createClient();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => onRefresh?.(), 500);
    };

    const channel = supabase
      .channel(`agent-live-${agentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
          filter: `assigned_agent_id=eq.${agentId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "follow_up_tasks",
          filter: `assigned_agent_id=eq.${agentId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lead_follow_up_activities",
          filter: `actor_id=eq.${agentId}`,
        },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [agentId, onRefresh]);

  return null;
}
