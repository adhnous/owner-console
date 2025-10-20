"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter, usePathname } from "next/navigation";

export default function OwnerGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<
    | { kind: "checking" }
    | { kind: "redirecting" }
    | { kind: "ok" }
    | { kind: "forbidden"; reason: string }
  >({ kind: "checking" });

  useEffect(() => {
    // Allow the login page to render without gating
    if (pathname === "/login") {
      setState({ kind: "ok" });
      return;
    }
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setState({ kind: "redirecting" });
        router.replace("/login");
        return;
      }
      try {
        const s = await getDoc(doc(db, "users", u.uid));
        const role = (s.exists() ? (s.get("role") as string) : null) || null;
        if (role === "owner" || role === "admin") {
          setState({ kind: "ok" });
        } else {
          setState({ kind: "forbidden", reason: "no_role" });
        }
      } catch (e: any) {
        setState({ kind: "forbidden", reason: e?.message || "role_read_failed" });
      }
    });
    return () => unsub();
  }, [router, pathname]);

  if (state.kind === "checking" || state.kind === "redirecting") {
    return (
      <div className="oc-container">
        <div className="oc-card">Loading…</div>
      </div>
    );
  }
  if (state.kind === "forbidden") {
    return (
      <div className="oc-container">
        <div className="oc-card" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No permission</div>
          <div className="oc-subtle">Sign in as an owner or admin to access the Owner Console.</div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
