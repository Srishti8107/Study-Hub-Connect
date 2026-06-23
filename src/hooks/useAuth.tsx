import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";
import * as api from "@/services/api";
import type { AppRole, User, Session } from "@/services/api";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, role: AppRole) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Listen to Firebase auth state changes
    const unsubscribe = api.onAuthStateChange(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Check if this is an admin email
          const isAdmin = api.isAdminEmail(firebaseUser.email || '');
          
          // Verify user exists in users collection (admin-approved only)
          const userRole = await api.getUserRole(firebaseUser.uid);
          const profile = await api.getUserProfile(firebaseUser.uid);
          
          if (!userRole) {
            if (isAdmin) {
              // Auto-create admin user in Firestore if they don't exist
              const { db } = await import('@/config/firebase');
              const { doc, setDoc } = await import('firebase/firestore');
              
              await setDoc(doc(db, 'users', firebaseUser.uid), {
                email: firebaseUser.email,
                full_name: firebaseUser.displayName || 'Admin',
                role: 'admin',
                created_at: new Date().toISOString(),
                approved_at: new Date().toISOString(),
              });
              
              // Set role to admin after creating the document
              const userData: User = {
                id: firebaseUser.uid,
                email: firebaseUser.email,
                full_name: profile?.full_name || firebaseUser.displayName || 'Admin',
                avatar_url: firebaseUser.photoURL,
              };
              
              const token = await firebaseUser.getIdToken();
              setUser(userData);
              setSession({ access_token: token, user: userData });
              setRole('admin');
              setLoading(false);
              return;
            } else {
              // User authenticated but not yet in Firestore (pending admin approval) — sign them out.
              await api.signOut();
              setUser(null);
              setSession(null);
              setRole(null);
              setLoading(false);
              
              toast({
                variant: "destructive",
                title: "Account Not Approved",
                description: "Your account is pending admin approval. Please wait for approval before signing in.",
              });
              return;
            }
          }
          
          // If user has admin role in Firestore, allow them to sign in
          if (userRole === 'admin' || isAdmin) {
            const token = await firebaseUser.getIdToken();
            const userData: User = {
              id: firebaseUser.uid,
              email: firebaseUser.email,
              full_name: profile?.full_name || firebaseUser.displayName || 'Admin',
              avatar_url: firebaseUser.photoURL,
            };
            
            setUser(userData);
            setSession({ access_token: token, user: userData });
            setRole(userRole);
            setLoading(false);
            return;
          }
          
          const token = await firebaseUser.getIdToken();
          const userData: User = {
            id: firebaseUser.uid,
            email: firebaseUser.email,
            full_name: profile?.full_name || firebaseUser.displayName,
            avatar_url: firebaseUser.photoURL,
          };
          setUser(userData);
          setSession({ access_token: token, user: userData });
          setRole(userRole);
        } catch (error) {
          console.error("Auth state change error:", error);
          await api.signOut();
          setUser(null);
          setSession(null);
          setRole(null);
        }
      } else {
        setUser(null);
        setSession(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

  const signUp = async (email: string, password: string, fullName: string, selectedRole: AppRole): Promise<{ error: Error | null }> => {
    try {
      const res = await api.signUp({ email, password, full_name: fullName, role: selectedRole });
      if (res.error) {
        toast({ 
          title: "Sign up failed", 
          description: res.error, 
          variant: "destructive" 
        });
        return { error: new Error(res.error) };
      }
      return { error: null };
    } catch (err: any) {
      toast({ 
        title: "Sign up failed", 
        description: err?.message ?? String(err), 
        variant: "destructive" 
      });
      return { error: err };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const res = await api.signIn({ email, password });
      if (res.error) {
        toast({ 
          title: "Sign in failed", 
          description: res.error, 
          variant: "destructive" 
        });
        return { error: new Error(res.error) };
      }
      
      return { error: null };
    } catch (err: any) {
      toast({ 
        title: "Sign in failed", 
        description: err?.message ?? String(err), 
        variant: "destructive" 
      });
      return { error: err };
    }
  };

  const signOut = async () => {
    await api.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
