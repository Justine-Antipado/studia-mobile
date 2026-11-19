/**
 * Inline icon set — no icon library needed.
 * Reference icons by name from core/config/navigation.js: getIcon('Home').
 */
const p = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
  focusable: 'false',
};

export const Icon = {
  Home: () => (<svg {...p}><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>),
  Users: () => (<svg {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><path d="M16 4.6a3.5 3.5 0 010 6.8M18 14.8c2 .6 3.2 2.3 3.5 5.2" /></svg>),
  Classes: () => (<svg {...p}><path d="M4 5h16v12H4z" /><path d="M8 21h8M12 17v4" /><path d="M8 9h8M8 13h5" /></svg>),
  Content: () => (<svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M10 9.5l5 2.5-5 2.5z" /></svg>),
  Assessments: () => (<svg {...p}><path d="M6 3h9l4 4v14H6z" /><path d="M9 12l1.8 1.8L15 9.6" /></svg>),
  Megaphone: () => (<svg {...p}><path d="M4 10v4l12 5V5z" /><path d="M16 9a3 3 0 010 6" /><path d="M7 15v4" /></svg>),
  Sparkle: () => (<svg {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M18.5 16.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" /></svg>),
  Chart: () => (<svg {...p}><path d="M4 20V5" /><path d="M4 20h16" /><rect x="8" y="12" width="3" height="5" /><rect x="14" y="8" width="3" height="9" /></svg>),
  Bell: () => (<svg {...p}><path d="M18 15V10a6 6 0 10-12 0v5l-1.5 3h15z" /><path d="M10 21h4" /></svg>),
  Shield: () => (<svg {...p}><path d="M12 3l8 3v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></svg>),
  Settings: () => (<svg {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></svg>),
  Help: () => (<svg {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.2A2.6 2.6 0 0114.5 10c0 1.7-2.5 2-2.5 3.6" /><path d="M12 17.2h.01" /></svg>),
  Logout: () => (<svg {...p}><path d="M9 4H5v16h4" /><path d="M16 8l4 4-4 4M20 12H9" /></svg>),
  Search: () => (<svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4-4" /></svg>),
  Lock: () => (<svg {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>),
  Unlock: () => (<svg {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 017.7-1.5" /></svg>),
  Menu: () => (<svg {...p} width="22" height="22"><path d="M4 7h16M4 12h16M4 17h16" /></svg>),
  Close: () => (<svg {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>),
  Check: () => (<svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>),
  Eye: () => (<svg {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>),
  EyeOff: () => (<svg {...p}><path d="M3 3l18 18M10.6 6.1A9.9 9.9 0 0112 6c6.5 0 10 6 10 6a17 17 0 01-3.2 3.9M6.6 6.6A17 17 0 002 12s3.5 6 10 6c1.7 0 3.2-.4 4.5-1" /></svg>),
  User: () => (<svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6" /></svg>),
  Chevron: () => (<svg {...p} width="14" height="14"><path d="M9 6l6 6-6 6" /></svg>),
  ChevronDown: () => (<svg {...p} width="14" height="14"><path d="M6 9l6 6 6-6" /></svg>),
  ChevronLeft: () => (<svg {...p} width="16" height="16"><path d="M15 6l-6 6 6 6" /></svg>),
  Panel: () => (<svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></svg>),
  Trash: () => (<svg {...p}><path d="M4 7h16" /><path d="M9 7V5h6v2" /><path d="M6 7l1 13h10l1-13" /></svg>),
  Download: () => (<svg {...p}><path d="M12 4v10" /><path d="M8 11l4 4 4-4" /><path d="M4 19h16" /></svg>),
  Refresh: () => (<svg {...p}><path d="M20 12a8 8 0 11-2.6-5.9" /><path d="M20 4v5h-5" /></svg>),
  Alert: () => (<svg {...p}><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17h.01" /></svg>),
  Info: () => (<svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>),
  Offline: () => (<svg {...p}><path d="M3 3l18 18" /><path d="M5.5 11a9 9 0 014.2-2.3M12 5c2.7 0 5.2 1 7 2.8" /><path d="M8.5 14.5a5 5 0 014.4-1.4M12 19h.01" /></svg>),
  Printer: () => (<svg {...p}><path d="M6 9V3h12v6" /><rect x="4" y="9" width="16" height="7" rx="1.5" /><path d="M8 17h8v4H8z" /></svg>),
};

/** Icon.Home-style lookup used by data-driven navigation. */
export const getIcon = (name) => Icon[name] ?? Icon.Info;
