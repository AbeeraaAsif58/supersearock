"use client";

import { useState, useTransition } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { LeadStatus, Profile } from "@/lib/auth/types";

type LeadsFilterFormProps = {
  q: string;
  filterStatus: string;
  filterSource: string;
  filterArea: string;
  filterAssignedAgent: string;
  budgetMin: string;
  budgetMax: string;
  agents: Profile[];
  leadStatuses: LeadStatus[];
  unassignedFilterValue: string;
};

export function LeadsFilterForm({
  q,
  filterStatus,
  filterSource,
  filterArea,
  filterAssignedAgent,
  budgetMin,
  budgetMax,
  agents,
  leadStatuses,
  unassignedFilterValue,
}: LeadsFilterFormProps) {
  const navigate = useNavigate();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    q,
    status: filterStatus,
    source: filterSource,
    area: filterArea,
    assigned: filterAssignedAgent,
    budget_min: budgetMin,
    budget_max: budgetMax,
  });

  const update = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams();

    Object.entries(form).forEach(([key, value]) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      if (key === "status" && trimmed === "all") return;
      params.set(key, trimmed);
    });
    params.set("page", "1");

    startTransition(() => {
      navigate(`/admin/leads?${params.toString()}`, { replace: true });
    });
  };

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-2.5 md:grid-cols-3 xl:grid-cols-4">
      <Input
        name="q"
        value={form.q}
        onChange={(event) => update("q", event.target.value)}
        placeholder="Search name/email/phone"
        className="h-10 rounded-lg"
      />
      <select
        name="status"
        value={form.status}
        onChange={(event) => update("status", event.target.value)}
        className="h-10 rounded-lg border border-[#CEC8BF] px-3 text-sm bg-white"
      >
        <option value="all">all status</option>
        {leadStatuses.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
      <Input
        name="source"
        value={form.source}
        onChange={(event) => update("source", event.target.value)}
        placeholder="Source"
        className="h-10 rounded-lg"
      />
      <Input
        name="area"
        value={form.area}
        onChange={(event) => update("area", event.target.value)}
        placeholder="Area"
        className="h-10 rounded-lg"
      />
      <Input
        name="budget_min"
        type="number"
        step="0.01"
        value={form.budget_min}
        onChange={(event) => update("budget_min", event.target.value)}
        placeholder="Budget min"
        className="h-10 rounded-lg"
      />
      <Input
        name="budget_max"
        type="number"
        step="0.01"
        value={form.budget_max}
        onChange={(event) => update("budget_max", event.target.value)}
        placeholder="Budget max"
        className="h-10 rounded-lg"
      />
      <select
        name="assigned"
        value={form.assigned}
        onChange={(event) => update("assigned", event.target.value)}
        className="h-10 rounded-lg border border-[#CEC8BF] px-3 text-sm bg-white"
      >
        <option value="">Any assignee</option>
        <option value={unassignedFilterValue}>Unassigned only</option>
        {agents.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.email}
          </option>
        ))}
      </select>
      <Button
        type="submit"
        disabled={isPending}
        className="h-10 rounded-lg bg-[#E55B3C] text-white hover:bg-[#c94b2f]"
      >
        {isPending ? "Applying..." : "Apply filters"}
      </Button>
    </form>
  );
}
