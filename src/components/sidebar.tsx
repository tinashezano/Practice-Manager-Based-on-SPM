"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { Role } from "@prisma/client";
import { Logo } from "@/components/logo";
import { SidebarTimer, type RunningTimer } from "@/components/timer";
import { initials } from "@/components/ui";
import { NAV } from "@/lib/nav";
import { can, ROLE_LABELS } from "@/lib/permissions";

type Props = {
  user: { name: string; email: string; role: Role };
  signOutAction: () => Promise<void>;
  unreadCount: number;
  timer: RunningTimer;
};

export function Sidebar({ user, signOutAction, unreadCount, timer }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [closed, setClosed] = useState<Record<string, boolean>>({});

  const sections = NAV.map((s) => ({
    ...s,
    items: s.items.filter((i) => !i.permission || can(user.role, i.permission)),
  })).filter((s) => s.items.length > 0);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
  // Prefer the most specific match so "/deals/pipeline" doesn't also light up "/deals".
  const activeHref = sections
    .flatMap((s) => s.items.map((i) => i.href))
    .filter(isActive)
    .sort((a, b) => b.length - a.length)[0];

  return (
    <aside
      className={clsx(
        "sticky top-0 flex h-screen shrink-0 flex-col border-r border-border bg-surface transition-[width]",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className="flex items-center justify-between px-4 py-5">
        <Logo compact={collapsed} />
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="rounded-md p-1 text-muted hover:bg-background"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {sections.map((section) => {
          const sectionActive = section.items.some((i) => i.href === activeHref);
          const isClosed = closed[section.title] && !collapsed;
          return (
            <div key={section.title} className="mb-3">
              {!collapsed && (
                <button
                  onClick={() => setClosed((c) => ({ ...c, [section.title]: !c[section.title] }))}
                  className={clsx(
                    "flex w-full items-center justify-between px-2 py-1.5 text-[13px] font-semibold",
                    sectionActive ? "text-brand" : "text-foreground",
                  )}
                >
                  {section.title}
                  <ChevronDown size={14} className={clsx("text-muted transition-transform", isClosed && "-rotate-90")} />
                </button>
              )}
              {!isClosed && (
                <ul className="mt-0.5 space-y-0.5">
                  {section.items.map((item) => {
                    const active = item.href === activeHref;
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          title={collapsed ? item.label : undefined}
                          className={clsx(
                            "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px]",
                            active ? "bg-brand-soft font-medium text-brand" : "text-muted hover:bg-background hover:text-foreground",
                            collapsed && "justify-center",
                          )}
                        >
                          <span className="relative shrink-0">
                            <Icon size={16} />
                            {collapsed && item.href === "/notifications" && unreadCount > 0 && (
                              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-danger" />
                            )}
                          </span>
                          {!collapsed && item.label}
                          {!collapsed && item.href === "/notifications" && unreadCount > 0 && (
                            <span className="ml-auto rounded-full bg-danger px-1.5 text-[10px] font-semibold text-white">{unreadCount > 99 ? "99+" : unreadCount}</span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      <SidebarTimer timer={timer} collapsed={collapsed} />

      <div className="flex items-center gap-2.5 border-t border-border px-4 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
          {initials(user.name)}
        </div>
        {!collapsed && (
          <Link href="/account" className="min-w-0 flex-1 rounded-md hover:text-brand" title="My account">
            <div className="truncate text-[13px] font-medium">{user.name}</div>
            <div className="truncate text-[11px] text-muted">{ROLE_LABELS[user.role]} · {user.email}</div>
          </Link>
        )}
        {!collapsed && (
          <form action={signOutAction}>
            <button className="rounded-md p-1 text-muted hover:bg-background hover:text-foreground" aria-label="Sign out" title="Sign out">
              <LogOut size={16} />
            </button>
          </form>
        )}
      </div>
    </aside>
  );
}
