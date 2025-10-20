"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where, doc, getDoc } from "firebase/firestore";

export default function NewServiceNotifier() {
  const [toasts, setToasts] = useState<Array<{ key: string; title: string; href: string; cta: string }>>([]);
  const [notifSupported, setNotifSupported] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | null>(null);
  const [roleInfo, setRoleInfo] = useState<{ role: string | null; error?: string } | null>(null);
  const initializedServices = useRef(false);
  const initializedSlots = useRef(false);
  const initializedDeletions = useRef(false);
  const unsubsRef = useRef<null | Array<() => void>>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifSupported(true);
      setNotifPermission(window.Notification.permission);
    }

    const off = onAuthStateChanged(auth, async (u) => {
      // Only listen when signed in
      // Tear down any previous listener
      if (unsubsRef.current) {
        for (const f of unsubsRef.current) { try { f(); } catch {} }
        unsubsRef.current = null;
      }
      if (!u) {
        initializedServices.current = false;
        initializedSlots.current = false;
        initializedDeletions.current = false;
        setRoleInfo(null);
        return;
      }

      // Check role first to avoid permission errors
      try {
        const me = await getDoc(doc(db, "users", u.uid));
        const role = (me.exists() ? (me.get("role") as string) : null) || null;
        setRoleInfo({ role });
        if (role !== "owner" && role !== "admin") {
          // Do not attach listener if not privileged
          return;
        }
      } catch (e: any) {
        setRoleInfo({ role: null, error: e?.message || "failed_to_read_role" });
        return;
      }

      function pushToast(t: { key: string; title: string; href: string; cta: string }) {
        setToasts((prev) => [...prev, t]);
        window.setTimeout(() => {
          setToasts((prev) => prev.filter((x) => x.key !== t.key));
        }, 6000);
      }

      const unsubs: Array<() => void> = [];

      // Listen for new pending services (skip initial batch)
      const q1 = query(collection(db, "services"), where("status", "==", "pending"));
      unsubs.push(onSnapshot(q1, (snap) => {
        if (!initializedServices.current) { initializedServices.current = true; return; }
        const added = snap.docChanges().filter((c) => c.type === 'added' && !c.doc.metadata.hasPendingWrites);
        if (added.length > 0) {
          const d = added[0].doc;
          const id = d.id;
          const title = (d.get('title') as string) || id;
          pushToast({ key: `svc_${id}_${Date.now()}` , title: `New service submitted: ${title}`, href: '/services', cta: 'Review' });
          if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
            try { new window.Notification('New service submitted', { body: title }); } catch {}
          }
        }
      }, (err) => {
        if ((err as any)?.code === 'permission-denied') setRoleInfo((prev) => ({ role: prev?.role ?? null, error: 'permission-denied' }));
      }));

      // Listen for pending extra slot requests
      const q2 = query(collection(db, 'service_slot_requests'), where('status', '==', 'pending'));
      unsubs.push(onSnapshot(q2, (snap) => {
        if (!initializedSlots.current) { initializedSlots.current = true; return; }
        const added = snap.docChanges().filter((c) => c.type === 'added' && !c.doc.metadata.hasPendingWrites);
        if (added.length > 0) {
          const d = added[0].doc;
          const email = (d.get('email') as string) || (d.get('uid') as string) || 'Provider';
          pushToast({ key: `slot_${d.id}_${Date.now()}`, title: `Extra slot request from ${email}`, href: '/service-slots', cta: 'Open' });
        }
      }));

      // Listen for pending deletion requests
      const q3 = query(collection(db, 'service_deletion_requests'), where('status', '==', 'pending'));
      unsubs.push(onSnapshot(q3, (snap) => {
        if (!initializedDeletions.current) { initializedDeletions.current = true; return; }
        const added = snap.docChanges().filter((c) => c.type === 'added' && !c.doc.metadata.hasPendingWrites);
        if (added.length > 0) {
          const d = added[0].doc;
          const title = (d.get('serviceTitle') as string) || (d.get('serviceId') as string) || 'Service';
          pushToast({ key: `del_${d.id}_${Date.now()}`, title: `Deletion request: ${title}`, href: '/service-deletions', cta: 'Review' });
        }
      }));

      unsubsRef.current = unsubs;
    });
    return () => {
      off();
      if (unsubsRef.current) {
        for (const f of unsubsRef.current) { try { f(); } catch {} }
        unsubsRef.current = null;
      }
    };
  }, []);

  // Prompt user to enable browser notifications (one-click)
  function enableBrowserNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (window.Notification.permission === "default") {
      window.Notification.requestPermission()
        .then((perm) => setNotifPermission(perm))
        .catch(() => {});
    }
  }

  const showNoPerm = !!roleInfo && (roleInfo.error === 'permission-denied' || (roleInfo.role !== 'owner' && roleInfo.role !== 'admin'));

  return (
    <div style={{ position: "fixed", top: 16, right: 16, zIndex: 1000, display: "flex", flexDirection: "column", gap: 8 }}>
      {notifSupported && notifPermission === "default" && (
        <button
          onClick={enableBrowserNotifications}
          className="oc-btn"
          style={{ background: "#fffbe6", borderColor: "#fde68a" }}
        >
          Enable browser notifications
        </button>
      )}

      {showNoPerm && (
        <div className="oc-card" style={{ minWidth: 280, background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No permission</div>
          <div className="oc-subtle">Sign in as an owner or admin to receive new service alerts.</div>
        </div>
      )}

      {toasts.map((t) => (
        <div key={t.key} className="oc-card" style={{ minWidth: 280 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{t.title}</div>
          <div className="oc-actions">
            <Link href={t.href} className="oc-btn oc-btn-primary">{t.cta}</Link>
            <button className="oc-btn" onClick={() => setToasts((prev) => prev.filter((x) => x.key !== t.key))}>Dismiss</button>
          </div>
        </div>
      ))}
    </div>
  );
}
