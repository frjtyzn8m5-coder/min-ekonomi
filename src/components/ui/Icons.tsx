// Clean, filled glyphs for the v4 design language. Paths carry no fill so they
// inherit the svg's `currentColor` (controlled by CSS `color`), except inside
// `.vh-tile` where CSS forces a dark fill.

type P = { size?: number; className?: string };
const S = (size: number, className: string | undefined, children: React.ReactNode) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} aria-hidden="true">
    {children}
  </svg>
);

export const IGrid = ({ size = 24, className }: P) =>
  S(size, className, <><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" /></>);

export const IDumbbell = ({ size = 24, className }: P) =>
  S(size, className, <><rect x="2" y="9.4" width="3.2" height="5.2" rx="1.3" /><rect x="5.2" y="7.6" width="3.2" height="8.8" rx="1.4" /><rect x="15.6" y="7.6" width="3.2" height="8.8" rx="1.4" /><rect x="18.8" y="9.4" width="3.2" height="5.2" rx="1.3" /><rect x="8.4" y="10.7" width="7.2" height="2.6" rx="1.3" /></>);

export const IHeart = ({ size = 24, className }: P) =>
  S(size, className, <path d="M12 20.3C7.9 17.6 3.5 14 3.5 9.9 3.5 7.3 5.4 5.4 7.8 5.4c1.6 0 3.1.9 4.2 2.4 1.1-1.5 2.6-2.4 4.2-2.4 2.4 0 4.3 1.9 4.3 4.5 0 4.1-4.4 7.7-8.5 10.4z" />);

export const IBolt = ({ size = 24, className }: P) =>
  S(size, className, <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />);

export const IMoon = ({ size = 24, className }: P) =>
  S(size, className, <path d="M13.5 3a8 8 0 1 0 7.5 10.4A6.5 6.5 0 0 1 13.5 3z" />);

export const IWallet = ({ size = 24, className }: P) =>
  S(size, className, <><rect x="3" y="6" width="18" height="13" rx="3" /><rect x="13.5" y="10" width="7.5" height="5" rx="2.5" fillOpacity="0.28" /></>);

export const IUtensils = ({ size = 24, className }: P) =>
  S(size, className, <><rect x="4.3" y="2.5" width="2.2" height="19" rx="1.1" /><path d="M4 2.5h2.8v6.2a1.4 1.4 0 0 1-2.8 0V2.5z" /><path d="M9.2 2.5c-1.2.4-2 1.9-2 4s.8 3.3 2 3.6V21a1.1 1.1 0 1 1-2.2 0V2.5h2.2z" opacity="0" /><path d="M16.5 2.5c-1.6.6-2.7 2.6-2.7 5.2 0 2.3 1 3.5 2.4 3.9V21a1.15 1.15 0 1 0 2.3 0V2.5h-2z" /></>);

export const ICalendar = ({ size = 24, className }: P) =>
  S(size, className, <><rect x="3" y="5" width="18" height="16" rx="3" /><rect x="3" y="5" width="18" height="5" rx="3" fillOpacity="0.3" /><rect x="7" y="2.5" width="2.2" height="4" rx="1.1" /><rect x="14.8" y="2.5" width="2.2" height="4" rx="1.1" /></>);

export const IFlame = ({ size = 24, className }: P) =>
  S(size, className, <path d="M12 2.5c.6 2.4 2.1 3.5 3.3 5 1 1.2 1.7 2.6 1.7 4.4a5 5 0 0 1-10 0c0-1.2.4-2.1 1-2.9.3 1 .9 1.6 1.7 1.8-.6-1.9.2-3.8 2.3-5.3-.3 1.4.1 2.3 1 3-.2-2 .3-3.9-.9-6z" />);

export const IPlay = ({ size = 24, className }: P) =>
  S(size, className, <path d="M8 5v14l11-7z" />);

export const IArrowRight = ({ size = 24, className }: P) =>
  S(size, className, <path d="M4 11h12.2l-4.6-4.6L13 5l7 7-7 7-1.4-1.4 4.6-4.6H4z" />);

export const ITrend = ({ size = 24, className }: P) =>
  S(size, className, <path d="M3.6 16.8 9 11.4l3.4 3.4L19 8.2V11h2V4h-7v2h2.8l-5.4 5.4L8 8 2.2 13.8z" />);

export const IUser = ({ size = 24, className }: P) =>
  S(size, className, <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-3.6 3.6-6 8-6s8 2.4 8 6v1H4z" /></>);

export const ISearch = ({ size = 24, className }: P) =>
  S(size, className, <path d="M10 4a6 6 0 1 0 3.9 10.6l4.3 4.3 1.4-1.4-4.3-4.3A6 6 0 0 0 10 4zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8z" />);

export const ILogout = ({ size = 24, className }: P) =>
  S(size, className, <><path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5v-2H5V5h5V3z" /><path d="M15.6 7.1 14.2 8.5l2.5 2.5H9v2h7.7l-2.5 2.5 1.4 1.4 4.9-4.9z" /></>);
