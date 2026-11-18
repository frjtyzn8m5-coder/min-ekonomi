import { useAuthStore } from '../store/useAuthStore';
import { motion, AnimatePresence } from 'framer-motion';
import Hero3D from '../components/ui/Hero3D';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

export default function Login() {
  const { signInWithGoogle, error, clearError } = useAuthStore();

  const handleSignIn = async () => {
    clearError();
    try {
      await signInWithGoogle();
    } catch {
      /* error is set in store */
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-bg flex items-center justify-center p-6">
      {/* Live 3D backdrop */}
      <div className="absolute inset-0 z-0 opacity-90">
        <Hero3D />
      </div>
      <div
        className="absolute inset-0 z-[1]"
        style={{ background: 'radial-gradient(90% 70% at 50% 42%, rgba(7,7,9,.35), rgba(7,7,9,.86) 72%), linear-gradient(0deg,#070709,transparent 55%)' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-md text-center"
      >
        <p className="text-[11px] uppercase tracking-[0.26em] text-gold mb-6">Vardagshub</p>
        <h1 className="font-display text-4xl sm:text-5xl leading-[1.02] tracking-tight">
          Allt du bygger —<br /><span className="italic text-gold">ett ställe.</span>
        </h1>
        <p className="text-mut text-[15px] mt-5 max-w-xs mx-auto">
          Ekonomi, träning och hälsa i samma rytm. Ett mål som styr allt.
        </p>

        <div className="mt-9">
          <button
            onClick={handleSignIn}
            className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-[15px] font-semibold text-[#2a1d08] transition-transform active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg,#f4d79a,#cf9a3f)', boxShadow: '0 16px 36px -16px rgba(233,193,120,.7)' }}
          >
            <GoogleIcon />
            <span className="flex-1 text-center">Fortsätt med Google</span>
          </button>
        </div>

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 14 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="text-xs rounded-lg px-3 py-2"
              style={{ color: 'var(--coral)', background: 'rgba(255,143,122,.12)' }}
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <p className="text-center text-xs text-faint mt-7">Varje konto har sin egen separata data</p>
      </motion.div>
    </div>
  );
}
