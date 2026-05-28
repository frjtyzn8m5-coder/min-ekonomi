import { useAuthStore } from '../store/useAuthStore';
import { Wallet } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Login() {
  const { login } = useAuthStore();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm"
      >
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-blue-500 flex items-center justify-center shadow-lg mb-5">
            <Wallet size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Min Ekonomi</h1>
          <p className="text-sm text-gray-400 mt-1.5">Din personliga ekonomiöversikt</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <button
            onClick={() => login()}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18Z"/>
              <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17Z"/>
              <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07Z"/>
              <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.31Z"/>
            </svg>
            Fortsätt med Google
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Dina ekonomidata lagras säkert i din Google-profil
        </p>
      </motion.div>
    </div>
  );
}
