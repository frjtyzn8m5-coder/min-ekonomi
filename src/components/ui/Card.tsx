import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}

export function Card({ children, className = '', padding = true }: CardProps) {
  return (
    <div className={`vh-card ${padding ? 'p-5' : ''} ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="font-display text-ink text-sm">{title}</h3>
        {subtitle && <p className="text-xs text-faint mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div>
      <p className="text-xs text-faint mb-0.5">{label}</p>
      <p className={`font-display tabular-nums text-2xl tracking-tight ${color || 'text-ink'}`}>{value}</p>
      {sub && <p className="text-xs text-faint mt-0.5">{sub}</p>}
    </div>
  );
}

export function Badge({ children, color = 'gray' }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    gray: 'bg-soft text-mut',
    blue: 'text-gold',
    green: 'text-cyan',
    red: 'text-coral',
    yellow: 'text-gold',
    purple: 'text-violet',
  };
  const bg: Record<string, string> = {
    blue: 'rgba(233,193,120,.12)',
    green: 'rgba(95,224,208,.15)',
    red: 'rgba(255,143,122,.15)',
    yellow: 'rgba(233,193,120,.12)',
    purple: 'rgba(155,140,255,.15)',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${colors[color] || colors.gray}`}
      style={bg[color] ? { background: bg[color] } : undefined}>
      {children}
    </span>
  );
}

export function EmptyState({ icon, title, description, action }: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && <div className="text-faint mb-3">{icon}</div>}
      <p className="text-sm font-medium text-mut">{title}</p>
      {description && <p className="text-xs text-faint mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
