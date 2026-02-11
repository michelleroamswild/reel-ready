import { NavLink } from "react-router-dom";
import { MessageSquareText, Film, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Phrases", icon: MessageSquareText },
  { to: "/videos", label: "Videos", icon: Film },
  { to: "/matches", label: "Matches", icon: Sparkles },
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
