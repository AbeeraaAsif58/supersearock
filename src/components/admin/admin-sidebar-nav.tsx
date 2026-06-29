"use client";

import { Link, useLocation } from "react-router-dom";

type NavItem = {
  href: string;
  label: string;
  badgeCount?: number;
};

type AdminSidebarNavProps = {
  items: NavItem[];
};

export function AdminSidebarNav({ items }: AdminSidebarNavProps) {
  const { pathname } = useLocation();

  return (
    <nav className="mt-5 space-y-1.5">
      {items.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            to={item.href}
            className={`flex items-center justify-between rounded-xl px-3.5 py-3 text-base transition ${
              isActive
                ? "bg-[#E55B3C] text-white shadow-sm"
                : "text-[#1A1A1A] hover:bg-[#F4F1ED]"
            }`}
          >
            <span>{item.label}</span>
            {!!item.badgeCount && item.badgeCount > 0 && (
              <span
                className={`inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-[#E55B3C]/10 text-[#E55B3C]"
                }`}
              >
                {item.badgeCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
