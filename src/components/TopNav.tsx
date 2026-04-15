import { NavLink } from "react-router-dom";
import { ChatText, FilmStrip, VideoCamera, TrendUp, UserCircle, Swatches, DeviceMobile, Desktop } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useMobilePreview } from "@/contexts/mobile-preview-context";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const links = [
  { to: "/", label: "Reels", icon: VideoCamera },
  { to: "/phrases", label: "Phrases", icon: ChatText },
  { to: "/videos", label: "Videos", icon: FilmStrip },
  { to: "/trends", label: "Trends", icon: TrendUp },
];

export function TopNav() {
  const { isMobilePreview, toggle } = useMobilePreview();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 hidden md:flex h-14 items-center border-b bg-card/90 backdrop-blur-md px-6">
      {/* Logo */}
      <div className="flex items-center gap-2 text-foreground font-semibold text-base select-none mr-8">
        <VideoCamera className="h-5 w-5 text-primary" weight="fill" />
        Reel Ready
      </div>

      {/* Nav links — hidden during mobile preview */}
      {!isMobilePreview && (
        <nav className="flex items-center gap-1 flex-1">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      )}

      {/* Spacer when preview is active */}
      {isMobilePreview && <div className="flex-1" />}

      {/* Right side */}
      <div className="flex items-center gap-1">
        {/* Design System link */}
        {!isMobilePreview && (
          <NavLink
            to="/design-system"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors mr-1",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )
            }
          >
            <Swatches className="h-4 w-4" />
            Design
          </NavLink>
        )}

        {/* Account */}
        {!isMobilePreview && (
          <NavLink
            to="/account"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors mr-2",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )
            }
          >
            <UserCircle className="h-4 w-4" />
            Account
          </NavLink>
        )}

        {/* Mobile preview toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggle}
              className={cn(
                "flex items-center justify-center h-8 w-8 rounded-md transition-colors",
                isMobilePreview
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              aria-label="Toggle mobile preview"
            >
              {isMobilePreview
                ? <Desktop className="h-4 w-4" />
                : <DeviceMobile className="h-4 w-4" />
              }
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {isMobilePreview ? "Exit mobile preview" : "Preview mobile layout"}
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
