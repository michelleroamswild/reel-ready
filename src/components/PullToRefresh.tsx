import { useState, useRef, useCallback, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowClockwise } from "@phosphor-icons/react";

const THRESHOLD = 80;
const MAX_PULL = 120;

export function PullToRefresh({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (refreshing) return;
      // Only activate when scrolled to top
      if (window.scrollY > 0) return;
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    },
    [refreshing]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!pulling.current || refreshing) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta < 0) {
        pulling.current = false;
        setPullDistance(0);
        return;
      }
      // Dampen the pull
      const distance = Math.min(MAX_PULL, delta * 0.4);
      setPullDistance(distance);
    },
    [refreshing]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;

    if (pullDistance >= THRESHOLD) {
      setRefreshing(true);
      setPullDistance(THRESHOLD * 0.6);
      await queryClient.invalidateQueries();
      // Brief delay so the spinner is visible
      await new Promise((r) => setTimeout(r, 400));
      setRefreshing(false);
    }
    setPullDistance(0);
  }, [pullDistance, queryClient]);

  const ready = pullDistance >= THRESHOLD;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Indicator */}
      <div
        className="flex justify-center overflow-hidden transition-[height] duration-200"
        style={{ height: pullDistance > 10 || refreshing ? pullDistance : 0 }}
      >
        <div className="flex items-center justify-center pt-2">
          <ArrowClockwise
            className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${
              refreshing ? "animate-spin" : ""
            }`}
            style={{
              transform: refreshing
                ? undefined
                : `rotate(${Math.min(pullDistance / THRESHOLD, 1) * 360}deg)`,
              opacity: Math.min(pullDistance / (THRESHOLD * 0.5), 1),
            }}
          />
          {ready && !refreshing && (
            <span className="text-xs text-muted-foreground ml-2">Release to refresh</span>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
