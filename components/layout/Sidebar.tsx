import Link from "next/link";
import {
  Bot,
  Brain,
  Home,
  Image,
  Key,
  MessageSquare,
  Settings,
  BookOpen,
  User,
} from "lucide-react";

const navMain = [
  { label: "Центр", href: "/", icon: Home },
  { label: "Агенти", href: "/agents", icon: Bot },
  { label: "Чат", href: "/chat", icon: MessageSquare },
];

const navVault = [
  { label: "Сховище", href: "/vault", icon: BookOpen },
  { label: "Галерея", href: "/gallery", icon: Image },
  { label: "Памʼять", href: "/memory", icon: Brain },
];

function NavButton({ href, label, icon: Icon }: any) {
  return (
    <Link
      href={href}
      title={label}
      className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--astro-border-dim)] text-[var(--astro-text-secondary)] hover:border-[var(--astro-red)] hover:text-[var(--astro-red)] transition-all"
    >
      <Icon size={18} />
    </Link>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-20 border-r border-[var(--astro-border-dim)] bg-[var(--astro-bg-surface)] p-4">

      <Link
        href="/"
        className="mb-8 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--astro-red)] text-white font-semibold"
      >
        A
      </Link>

      <nav className="space-y-3">
        {navMain.map((item) => (
          <NavButton key={item.label} {...item} />
        ))}
      </nav>

      <div className="my-5 h-px w-10 bg-[var(--astro-border-dim)]" />

      <nav className="space-y-3">
        {navVault.map((item) => (
          <NavButton key={item.label} {...item} />
        ))}
      </nav>

      <div className="absolute bottom-4 left-4 space-y-3">

        <NavButton
          href="/providers"
          label="API ключі"
          icon={Key}
        />

        <NavButton
          href="/account"
          label="Акаунт"
          icon={User}
        />

        <NavButton
          href="/settings"
          label="Налаштування"
          icon={Settings}
        />
      </div>
    </aside>
  );
}