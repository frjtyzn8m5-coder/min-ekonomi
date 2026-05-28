import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  isAuthenticated: boolean;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
}

async function sha256hex(message: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,

      login: async (pin: string) => {
        const expected = import.meta.env.VITE_APP_PIN_HASH as string | undefined;
        if (!expected) {
          // Dev-läge: ingen PIN konfigurerad → öppen åtkomst
          set({ isAuthenticated: true });
          return true;
        }
        const hash = await sha256hex(pin);
        const ok = hash === expected.toLowerCase();
        if (ok) set({ isAuthenticated: true });
        return ok;
      },

      logout: () => set({ isAuthenticated: false }),
    }),
    {
      name: 'ekonomi_auth',
      partialize: (s) => ({ isAuthenticated: s.isAuthenticated }),
    }
  )
);
