import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useClerk, useUser } from "@clerk/tanstack-react-start";

type ShopUser = { id: string; email: string | null };
type AuthState = {
  user: ShopUser | null;
  loading: boolean;
  accountAvailable: boolean;
  signOut: (() => Promise<void>) | null;
};
const AuthContext = createContext<AuthState>({
  user: null,
  loading: false,
  accountAvailable: false,
  signOut: null,
});
export const useShopAuth = () => useContext(AuthContext);

// Identity state comes from Clerk. This provider owns the identity-transition
// side effects (route + query invalidation) so account controls stay fresh.
export function AuthProvider({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  return enabled ? (
    <ClerkAuthProvider>{children}</ClerkAuthProvider>
  ) : (
    <AuthContext.Provider
      value={{ user: null, loading: false, accountAvailable: false, signOut: null }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function ClerkAuthProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const clerk = useClerk();
  const router = useRouter();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!isLoaded) return;
    void router.invalidate();
    void queryClient.invalidateQueries();
  }, [isLoaded, user?.id, router, queryClient]);
  return (
    <AuthContext.Provider
      value={{
        user:
          isSignedIn && user
            ? { id: user.id, email: user.primaryEmailAddress?.emailAddress ?? null }
            : null,
        loading: !isLoaded,
        accountAvailable: true,
        signOut: async () => {
          await clerk.signOut();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
