import { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { Wallet, User, Lock, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Login() {
  const { login, register, error, clearError } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const switchMode = () => { setMode(m => m === 'login' ? 'register' : 'login'); clearError(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    try {
      if (mode === 'login') await login(username, password);
      else await register(username, password);
    } catch {
      // error is set in store
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-500 flex items-center justify-center shadow-lg mb-4">
            <Wallet size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Min Ekonomi</h1>
          <p className="text-sm text-gray-400 mt-1">
            {mode === 'login' ? 'Logga in på ditt konto' : 'Skapa ett nytt konto'}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          {/* Mode tabs */}
          <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm font-medium">
            {(['login', 'register'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); clearError(); }}
                className={`flex-1 py-2.5 transition-colors ${
                  mode === m ? 'bg-blue-500 text-white' : 'text-gray-500 hover:bg-gray-50'
                }`}>
                {m === 'login' ? 'Logga in' : 'Registrera'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Username */}
            <div className="relative">
              <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Användarnamn"
                autoComplete="username"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'Lösenord (minst 6 tecken)' : 'Lösenord'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <button type="submit" disabled={loading || !username.trim() || !password}
              className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
              {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {mode === 'login' ? 'Logga in' : 'Skapa konto'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-5">
          Varje konto har sin egen separata data
        </p>
      </motion.div>
    </div>
  );
}
