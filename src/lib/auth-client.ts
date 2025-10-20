import { auth } from '@/lib/firebase';
<<<<<<< HEAD
import { onAuthStateChanged } from 'firebase/auth';

export async function getIdTokenOrThrow(): Promise<string> {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe(); // Clean up the listener
      
      if (!user) {
        reject(new Error('not_signed_in'));
        return;
      }

      try {
        // Force refresh to get a fresh token
        const token = await user.getIdToken(/* forceRefresh */ true);
        resolve(token);
      } catch (error) {
        reject(new Error('token_refresh_failed'));
      }
    }, (error) => {
      unsubscribe();
      reject(new Error('auth_state_error'));
    });
  });
}
=======

export async function getIdTokenOrThrow(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('not_signed_in');
  const token = await user.getIdToken(/* forceRefresh */ true);
  return token;
}
>>>>>>> origin/main
