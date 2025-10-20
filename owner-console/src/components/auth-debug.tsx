"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getIdTokenOrThrow } from "@/lib/auth-client";

export default function AuthDebug() {
  const [authState, setAuthState] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthState({
        currentUser: user ? {
          uid: user.uid,
          email: user.email,
          emailVerified: user.emailVerified,
        } : null,
        isAuthenticated: !!user
      });
    });

    return () => unsubscribe();
  }, []);

  const testToken = async () => {
    try {
      const newToken = await getIdTokenOrThrow();
      setToken(newToken);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      setToken(null);
    }
  };

  return (
    <div style={{ padding: '16px', border: '1px solid #ccc', margin: '16px 0' }}>
      <h3>Auth Debug</h3>
      <div>
        <strong>Auth State:</strong> 
        <pre>{JSON.stringify(authState, null, 2)}</pre>
      </div>
      <button onClick={testToken} style={{ margin: '8px 0' }}>
        Test Get Token
      </button>
      {token && (
        <div>
          <strong>Token:</strong> 
          <div style={{ wordBreak: 'break-all' }}>{token.substring(0, 50)}...</div>
        </div>
      )}
      {error && (
        <div style={{ color: 'red' }}>
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
}