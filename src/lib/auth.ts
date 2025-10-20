import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  reload,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';

export const signUp = (email: string, password: string) => {
  return createUserWithEmailAndPassword(auth, email, password);
};

export const signIn = (email: string, password: string) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const signOut = () => {
  return firebaseSignOut(auth);
};

export const resetPassword = (email: string) => {
  return sendPasswordResetEmail(auth, email);
};

export const sendVerificationEmail = (user?: User | null) => {
  const u = user ?? auth.currentUser;
  if (!u) throw new Error('No authenticated user');
  return sendEmailVerification(u);
};

export const reloadCurrentUser = async () => {
  if (auth.currentUser) {
    await reload(auth.currentUser);
  }
};

export const isCurrentUserVerified = () => !!auth.currentUser?.emailVerified;
