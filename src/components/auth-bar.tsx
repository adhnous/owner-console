"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function AuthBar() {
  const [email, setEmail] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setEmail(u?.email ?? null));
    return () => unsub();
  }, []);

  async function handleSignOut() {
    try {
      await signOut(auth);
    } finally {
      router.replace("/login");
    }
  }

  return (
    <div className="oc-topbar">
      <div className="oc-subtle">Owner Console</div>
      {email ? (
        <div className="oc-topbar-actions">
          <div className="oc-avatar" aria-hidden>
            {(email || 'A').slice(0,1).toUpperCase()}
          </div>
          <span className="oc-subtle oc-ellips" title={email}>{email}</span>
          <button className="oc-btn" onClick={handleSignOut}>Sign out</button>
        </div>
      ) : (
        <Link href="/login" className="oc-btn">Login</Link>
      )}
    </div>
  );
}
