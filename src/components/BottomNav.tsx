import { NavLink } from "react-router-dom";
import { ChatText, FilmStrip, VideoCamera } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Reels", icon: VideoCamera },
  { to: "/phrases", label: "Phrases", icon: ChatText },
  { to: "/videos", label: "Videos", icon: FilmStrip },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs transition-colors",
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
