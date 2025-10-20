'use client';

import {
  useState,
  useEffect,
  createContext,
  useContext,
  ReactNode,
} from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { UserProfile, getUserProfile } from '@/lib/user';

type AuthContextType = {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | undefined;
    let isMounted = true;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!isMounted) return;

      setLoading(true);
      
      // Clean up previous document listener
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = undefined;
      }

      if (firebaseUser) {
        setUser(firebaseUser);
        
        try {
          // Real-time subscribe to user profile
          const userRef = doc(db, 'users', firebaseUser.uid);
          unsubscribeDoc = onSnapshot(
            userRef, 
            (snap) => {
              if (!isMounted) return;
              
              if (snap.exists()) {
                const profileData = snap.data() as UserProfile;
                setUserProfile(profileData);
              } else {
                setUserProfile(null);
              }
              setLoading(false);
            }, 
            (error) => {
              if (!isMounted) return;
              console.error('Error fetching user profile:', error);
              setUserProfile(null);
              setLoading(false);
            }
          );
        } catch (error) {
          console.error('Error setting up profile listener:', error);
          if (isMounted) {
            setUserProfile(null);
            setLoading(false);
          }
        }
      } else {
        setUser(null);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribeAuth();
      if (unsubscribeDoc) {
        unsubscribeDoc();
      }
    };
  }, []);

  const value: AuthContextType = {
    user,
    userProfile,
    loading,
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};