import { NavLink } from "react-router-dom";
import {
  ChatText,
  FilmStrip,
  VideoCamera,
  UserCircle,
  Swatches,
  MagnifyingGlass,
  Layout,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const libraryLinks = [
  { to: "/", label: "Reels", icon: VideoCamera, end: true },
  { to: "/videos", label: "Videos", icon: FilmStrip },
  { to: "/phrases", label: "Phrases", icon: ChatText },
];

const workshopLinks = [
  { to: "/templates", label: "Templates", icon: Layout },
];

const footerLinks = [
  { to: "/design-system", label: "Design", icon: Swatches },
  { to: "/account", label: "Account", icon: UserCircle },
];

function SideLink({
  to,
  label,
  icon: Icon,
  end,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string; weight?: "regular" | "fill" }>;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[13.5px] font-medium tracking-tight transition-colors",
          isActive
            ? "bg-brand-soft text-ink"
            : "text-ink-2 hover:bg-surface-2 hover:text-ink"
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute -left-3.5 top-2 bottom-2 w-[3px] rounded-full bg-brand" />
          )}
          <Icon className="h-[16px] w-[16px]" weight={isActive ? "fill" : "regular"} />
          {label}
        </>
      )}
    </NavLink>
  );
}

export function SideNav() {
  return (
    <aside className="hidden md:flex md:flex-col w-[224px] shrink-0 border-r border-hairline bg-mist sticky top-0 h-screen px-3.5 py-6">
      {/* Brand */}
      <NavLink to="/" className="flex items-center gap-2 px-2 pb-4 select-none">
        <span className="grid place-items-center h-7 w-7 rounded-md bg-ink text-mist text-[12px] font-display font-extrabold tracking-tight">
          R
        </span>
        <span className="font-display text-[19px] font-extrabold tracking-[-0.04em] leading-none text-ink">
          Reel<span className="text-brand">.</span>Ready
        </span>
      </NavLink>

      {/* Search (decorative) */}
      <div className="flex items-center gap-2 px-3 h-9 rounded-md border border-hairline bg-surface text-muted-foreground text-[12.5px] mt-2">
        <MagnifyingGlass className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 truncate">Search…</span>
        <span className="font-mono text-[10px] tracking-wide text-muted-foreground/70 px-1.5 py-0.5 rounded border border-hairline bg-mist">
          ⌘K
        </span>
      </div>

      {/* Nav */}
      <div className="flex flex-col mt-2">
        <p className="px-3 pt-5 pb-2 text-[10.5px] font-semibold tracking-[0.12em] uppercase text-muted-foreground/80">
          Library
        </p>
        <nav className="flex flex-col gap-px">
          {libraryLinks.map((link) => (
            <SideLink key={link.to} {...link} />
          ))}
        </nav>

        <p className="px-3 pt-5 pb-2 text-[10.5px] font-semibold tracking-[0.12em] uppercase text-muted-foreground/80">
          Workshop
        </p>
        <nav className="flex flex-col gap-px">
          {workshopLinks.map((link) => (
            <SideLink key={link.to} {...link} />
          ))}
        </nav>
      </div>

      {/* Footer nav */}
      <div className="mt-auto pt-4 border-t border-hairline">
        <nav className="flex flex-col gap-px">
          {footerLinks.map((link) => (
            <SideLink key={link.to} {...link} />
          ))}
        </nav>
      </div>
    </aside>
  );
}
