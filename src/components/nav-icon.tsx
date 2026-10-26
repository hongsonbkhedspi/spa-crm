import {
  BookOpen,
  CalendarDays,
  Droplet,
  FlaskConical,
  Layers,
  MoreHorizontal,
  PenLine,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Users,
} from "lucide-react";

function BeadsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="5" cy="12" r="2.5" fill="currentColor" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
      <circle cx="19" cy="12" r="2.5" />
    </svg>
  );
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  sun: Sun,
  pen: PenLine,
  book: BookOpen,
  calendar: CalendarDays,
  beads: BeadsIcon,
  droplet: Droplet,
  users: Users,
  send: Send,
  sparkles: Sparkles,
  flask: FlaskConical,
  layers: Layers,
  shield: ShieldCheck,
  settings: Settings,
  more: MoreHorizontal,
};

export function NavIcon({ name, className }: { name: string; className?: string }) {
  const I = ICONS[name] ?? MoreHorizontal;
  return <I className={className} />;
}
