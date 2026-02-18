import { NavLink } from "react-router-dom";
import { ChatText, FilmStrip, VideoCamera, TrendUp, UserCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Reels", icon: VideoCamera },
  { to: "/phrases", label: "Phrases", icon: ChatText },
  { to: "/videos", label: "Videos", icon: FilmStrip },
  { to: "/trends", label: "Trends", icon: TrendUp },
  { to: "/account", label: "Account", icon: UserCircle },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg px-4">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex flex-1 flex-col items-center gap-0.5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-xs transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
