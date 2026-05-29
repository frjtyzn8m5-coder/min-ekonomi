import { CalendarDays, Layers, Upload, Globe } from 'lucide-react';
import { motion } from 'framer-motion';

const COMING_SOON = [
  {
    icon: Globe,
    label: 'Microsoft Teams & Outlook',
    description: 'Koppla ditt Microsoft-konto och synka alla möten och events direkt.',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    icon: CalendarDays,
    label: 'Google Calendar',
    description: 'Hämta in Google Calendar-events i samma vy som resten.',
    color: 'text-red-500',
    bg: 'bg-red-50',
  },
  {
    icon: Layers,
    label: 'Apple Calendar (iCloud)',
    description: 'CalDAV-integration med iCloud för att synka din Apple-kalender.',
    color: 'text-gray-700',
    bg: 'bg-gray-100',
  },
  {
    icon: Upload,
    label: 'Schemaläggning & ICS-import',
    description: 'Importera scheman som Excel/CSV eller prenumerera på iCal-URL:er.',
    color: 'text-violet-600',
    bg: 'bg-violet-50',
  },
];

export default function CalendarHome() {
  return (
    <div className="min-h-full p-6 max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
            <CalendarDays size={18} className="text-violet-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Kalender</h1>
        </div>
        <p className="text-sm text-gray-400">
          Samlad kalendervy för Teams, Google, Apple och egna scheman – under uppbyggnad.
        </p>
      </motion.div>

      <div className="space-y-3">
        {COMING_SOON.map(({ icon: Icon, label, description, color, bg }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: i * 0.06 }}
            className="bg-white rounded-2xl border border-gray-100 p-5"
          >
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <Icon size={18} className={color} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-gray-900 text-sm">{label}</span>
                  <span className="text-[10px] font-medium bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">
                    Kommer snart
                  </span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">{description}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
