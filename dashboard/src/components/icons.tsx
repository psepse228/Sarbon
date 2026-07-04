/** Minimal inline stroke icons — no icon package dependency, 22x22, currentColor. */

type IconProps = { className?: string };

const base = {
  width: 22,
  height: 22,
  viewBox: "0 0 22 22",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function HomeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3.5 10.2 11 4l7.5 6.2" />
      <path d="M5.3 8.7V18h11.4V8.7" />
      <path d="M9 18v-4.6h4V18" />
    </svg>
  );
}

export function BellIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 8.5a5 5 0 0 1 10 0c0 3.2 1.2 4.4 1.9 5.3.3.4 0 1-.5 1H4.6c-.5 0-.8-.6-.5-1 .7-.9 1.9-2.1 1.9-5.3Z" />
      <path d="M9.2 17.5a1.9 1.9 0 0 0 3.6 0" />
    </svg>
  );
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3.7" y="5" width="14.6" height="13" rx="2.4" />
      <path d="M3.7 9h14.6" />
      <path d="M7.3 3.3V6.4M14.7 3.3V6.4" />
      <circle cx="11" cy="13" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function GridIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3.6" y="3.6" width="6" height="6" rx="1.6" />
      <rect x="12.4" y="3.6" width="6" height="6" rx="1.6" />
      <rect x="3.6" y="12.4" width="6" height="6" rx="1.6" />
      <rect x="12.4" y="12.4" width="6" height="6" rx="1.6" />
    </svg>
  );
}

export function ChevronLeftIcon({ className }: IconProps) {
  return (
    <svg {...base} width={18} height={18} viewBox="0 0 22 22" className={className}>
      <path d="M13.5 5 7 11l6.5 6" />
    </svg>
  );
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg {...base} width={18} height={18} viewBox="0 0 22 22" className={className}>
      <path d="M8.5 5 15 11l-6.5 6" />
    </svg>
  );
}

export function TagIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M11.5 3.5h5a2 2 0 0 1 2 2v5L10 19 3.5 12.5 11.5 3.5Z" />
      <circle cx="14.3" cy="7.7" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function QuestionIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="11" cy="11" r="7.5" />
      <path d="M8.7 8.7a2.3 2.3 0 0 1 4.4.9c0 1.5-2.1 1.7-2.1 3.4" />
      <circle cx="11" cy="15.3" r="0.15" fill="currentColor" stroke="currentColor" />
    </svg>
  );
}

export function UsersIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="8.3" cy="8" r="2.6" />
      <path d="M3.7 18c.5-2.9 2.3-4.6 4.6-4.6s4.1 1.7 4.6 4.6" />
      <circle cx="15" cy="8.5" r="2" />
      <path d="M14 13.6c1.8.2 3 1.7 3.4 4.4" />
    </svg>
  );
}

export function DocumentIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6.5 3.6h6l3.3 3.3v11.5h-9.3V3.6Z" />
      <path d="M12.3 3.6v3.5h3.3" />
      <path d="M8.6 12h5M8.6 14.8h5" />
    </svg>
  );
}

export function ChatIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 5.5h14a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H9.5L5.5 18.3V15H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

export function SparkleIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M11 3.5 12.4 8.6 17.5 10 12.4 11.4 11 16.5 9.6 11.4 4.5 10 9.6 8.6 11 3.5Z" />
      <path d="M17.5 14.5 18.1 16.7 20.3 17.3 18.1 17.9 17.5 20.1 16.9 17.9 14.7 17.3 16.9 16.7 17.5 14.5Z" />
    </svg>
  );
}
