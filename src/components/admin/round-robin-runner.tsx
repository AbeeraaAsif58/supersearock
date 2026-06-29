"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { runRoundRobin, type RoundRobinStatus } from "@/lib/distribution/round-robin-client";

type RoundRobinRunnerProps = {
  initialRemaining: number;
  onComplete?: () => void;
};

export function RoundRobinRunner({ initialRemaining, onComplete }: RoundRobinRunnerProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [status, setStatus] = useState<RoundRobinStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const liveRemaining = useMemo(() => {
    if (status?.state === "running" || status?.state === "completed") {
      return status.remainingLeads;
    }
    return initialRemaining;
  }, [initialRemaining, status]);

  const startRoundRobin = async () => {
    setError(null);
    setIsStarting(true);
    try {
      await runRoundRobin((progress) => setStatus(progress));
      onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start round-robin.");
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[#EAE7E2] bg-[#FAF9F7] px-3 py-2 text-sm text-[#1A1A1A]">
        Unassigned eligible leads remaining: <span className="font-semibold">{liveRemaining}</span>
      </div>

      <div className="rounded-lg border border-[#EAE7E2] bg-white px-3 py-2 text-sm text-[#1A1A1A]">
        Notification counter (summary emails):{" "}
        <span className="font-semibold">{status?.notificationsSent ?? 0}</span>
      </div>

      {status && (
        <div className="rounded-lg border border-[#EAE7E2] bg-white px-3 py-2 text-xs text-gray-700">
          Progress: {status.processedLeads}/{status.totalLeads} leads • Batch {status.completedBatches}/
          {status.totalBatches} • State: {status.state}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button
        type="button"
        disabled={isStarting || status?.state === "running"}
        onClick={startRoundRobin}
        className="h-10 rounded-lg bg-[#E55B3C] hover:bg-[#c94b2f]"
      >
        {isStarting || status?.state === "running" ? "Running..." : "Run Round-Robin on Unassigned Leads"}
      </Button>
    </div>
  );
}
