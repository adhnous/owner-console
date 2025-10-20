"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) => (pathname === href ? "active" : "");
  return (
    <aside className="oc-sidebar">
      <div className="oc-brand">
        <div className="oc-brandmark">KC</div>
        <div>
          <div className="oc-brand-title">Khidmaty Console</div>
          <div className="oc-brand-sub">Owner & Admin</div>
        </div>
      </div>
      <nav className="oc-nav">
        <Link href="/users" className={`oc-navlink ${isActive('/users')}`}>Users</Link>
        <Link href="/services" className={`oc-navlink ${isActive('/services')}`}>Services</Link>
        <Link href="/services/admin" className={`oc-navlink ${isActive('/services/admin')}`}>All Services</Link>
        <Link href="/service-slots" className={`oc-navlink ${isActive('/service-slots')}`}>Service Slots</Link>
        <Link href="/service-deletions" className={`oc-navlink ${isActive('/service-deletions')}`}>Deletion Requests</Link>
        <Link href="/ads" className={`oc-navlink ${isActive('/ads')}`}>Ads Manager</Link>
        <Link href="/transactions" className={`oc-navlink ${isActive('/transactions')}`}>Transactions</Link>
        <Link href="/settings" className={`oc-navlink ${isActive('/settings')}`}>Settings</Link>
      </nav>
    </aside>
  );
}
