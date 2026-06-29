"use client";

import { useMemo, useState } from "react";

type SearchableLeadSelectProps = {
  name: string;
  required?: boolean;
  leads: Array<{
    id: string;
    full_name: string;
    email?: string | null;
    phone?: string | null;
  }>;
};

export function SearchableLeadSelect({ name, required = false, leads }: SearchableLeadSelectProps) {
  const [query, setQuery] = useState("");

  const filteredLeads = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((lead) => {
      const text = `${lead.full_name} ${lead.email ?? ""} ${lead.phone ?? ""}`.toLowerCase();
      return text.includes(q);
    });
  }, [leads, query]);

  return (
    <div className="space-y-1.5">
      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search lead by name/email/phone"
        className="h-9 w-full rounded-lg border border-[#CEC8BF] bg-white px-3 text-sm"
      />
      <select
        name={name}
        className="h-10 w-full rounded-lg border border-[#CEC8BF] bg-white px-3 text-sm"
        required={required}
      >
        <option value="">Select lead...</option>
        {filteredLeads.map((lead) => (
          <option key={lead.id} value={lead.id}>
            {lead.full_name}
          </option>
        ))}
      </select>
    </div>
  );
}
