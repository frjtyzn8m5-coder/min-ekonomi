import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { Wallet, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Login() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const { login } = useAuthStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) return;
    const ok = await login(pin);
    if (!ok) {
      setError(true);
      setShake(true);
      setPin('');
      setTimeout(() => setShake(false), 600);
      setTimeout(() => setError(false), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={shake ? { x: [-8, 8, -8, 8, 0] } : { opacity: 1, y: 0 }}
        transition={{ duration: shake ? 0.4 : 0.3 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-500 flex items-center justify-center shadow-lg mb-4">
            <Wallet size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Min Ekonomi</h1>
          <p className="text-sm text-gray-400 mt-1">Ange ditt lösenord</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={inputRef}
              type="password"
              value={pin}
              onChange={e => setPin(e.target.value)}
              placeholder="Lösenord"
              autoComplete="current-password"
              className={`w-full pl-11 pr-4 py-3.5 rounded-xl border text-sm transition-all outline-none
                ${error
                  ? 'border-red-300 bg-red-50 text-red-900 placeholder-red-300'
                  : 'border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100'
                }`}
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-xs text-red-500 text-center"
              >
                Fel lösenord, försök igen
              </motion.p>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={!pin}
            className="w-full py-3.5 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400
              text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Logga in
          </button>
        </form>
      </motion.div>
    </div>
  );
}
