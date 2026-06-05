import { NavLink } from "react-router-dom";
import { ChatText, FilmStrip, VideoCamera, UserCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Reels", icon: VideoCamera },
  { to: "/phrases", label: "Phrases", icon: ChatText },
  { to: "/videos", label: "Videos", icon: FilmStrip },
  { to: "/account", label: "Account", icon: UserCircle },
];

export function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-hairline bg-mist/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[390px] px-3">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "relative flex flex-1 flex-col items-center gap-1 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-[10.5px] font-medium tracking-wide transition-colors",
                isActive ? "text-ink" : "text-muted-foreground"
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute -top-px left-1/2 -translate-x-1/2 w-7 h-[3px] rounded-full bg-brand" />
                )}
                <Icon className="h-[22px] w-[22px]" weight={isActive ? "fill" : "regular"} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
