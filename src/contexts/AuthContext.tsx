import React, { createContext, useContext, useEffect, useState } from 'react';
import { rtdb } from '../lib/firebase';
import { ref, get, set, serverTimestamp } from 'firebase/database';
import { stringToNumbers, numbersToString } from '../lib/utils';

export interface UserProfile {
  userId: string;
  displayName: string;
  photoData: string;
  createdAt: any;
  updatedAt: any;
}

interface AuthContextType {
  profile: UserProfile | null;
  loading: boolean;
  signIn: (displayName: string, photoData: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeLocalUser = async () => {
      try {
        const storedUserId = localStorage.getItem('darkroom_user_id');
        if (storedUserId) {
          const userRef = ref(rtdb, `users/${storedUserId}`);
          const snapshot = await get(userRef);
          if (snapshot.exists()) {
            const data = snapshot.val();
            setProfile({
              userId: storedUserId,
              displayName: numbersToString(data.displayName),
              photoData: numbersToString(data.photoData),
              createdAt: data.createdAt,
              updatedAt: data.updatedAt
            });
          }
        }
      } catch (err) {
        console.error("Failed to load user profile:", err);
      } finally {
        setLoading(false);
      }
    };
    initializeLocalUser();
  }, []);

  const signIn = async (displayName: string, photoData: string) => {
    let userId = localStorage.getItem('darkroom_user_id');
    if (!userId) {
      userId = 'usr_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
      localStorage.setItem('darkroom_user_id', userId);
    }
    
    try {
      const userRef = ref(rtdb, `users/${userId}`);
      const userProfileDb = {
        userId: userId, // Keep ID clear to query
        displayName: stringToNumbers(displayName),
        photoData: stringToNumbers(photoData),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await set(userRef, userProfileDb);
      
      setProfile({
        userId,
        displayName,
        photoData,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    } catch (error) {
      console.error(error);
    }
  };

  const signOut = async () => {
    localStorage.removeItem('darkroom_user_id');
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

