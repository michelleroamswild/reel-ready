import { useState } from "react";
import { useTrendingAudio } from "@/hooks/use-trending-audio";
import { useReferencePatternHistory } from "@/hooks/use-reference-analysis";
import { AddTrendingAudioDialog } from "@/components/AddTrendingAudioDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowsClockwise,
  MusicNote,
  ArrowSquareOut,
  CaretDown,
  CaretUp,
  Lightning,
  Plus,
} from "@phosphor-icons/react";
import type { ReferencePatternEntry } from "@/hooks/use-reference-analysis";

export default function TrendsPage() {
  const { data: tracks, isLoading: audioLoading, refresh } = useTrendingAudio();
  const { data: patternHistory, isLoading: patternsLoading } =
    useReferencePatternHistory();
  const [refreshing, setRefreshing] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [expandedPatternId, setExpandedPatternId] = useState<string | null>(
    null
  );

  const handleRefresh = () => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 2000);
  };

  const latestFetch = tracks.length > 0 ? tracks[0].fetched_at : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Trends</h1>
      </div>

      {/* Trending Audio */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MusicNote className="h-4 w-4 text-muted-foreground" weight="fill" />
            <h2 className="text-sm font-medium">Trending Audio</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => setAddDialogOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2"
              onClick={handleRefresh}
              disabled={refreshing || audioLoading}
            >
              <ArrowsClockwise
                className={`h-3.5 w-3.5 mr-1 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </div>

        {latestFetch && (
          <p className="text-[10px] text-muted-foreground">
            Last updated: {new Date(latestFetch).toLocaleString()}
          </p>
        )}

        {audioLoading ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Loading trending audio...
          </p>
        ) : tracks.length === 0 ? (
          <div className="text-center py-6 rounded-lg border bg-muted/30">
            <p className="text-sm text-muted-foreground">
              No trending audio yet. Add tracks manually or research trends for
              your niche.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setAddDialogOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add tracks
            </Button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {tracks.map((track, i) => (
              <div
                key={track.id}
                className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2"
              >
                <span className="text-xs font-mono text-muted-foreground w-5 text-right shrink-0">
                  {track.trend_rank ?? i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{track.title}</p>
                  {track.artist && (
                    <p className="text-xs text-muted-foreground truncate">
                      {track.artist}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {track.source && track.source !== "api" && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 hidden sm:inline-flex"
                    >
                      {track.source === "manual"
                        ? "manual"
                        : track.source === "ai_research"
                          ? "AI"
                          : track.source === "url_extract"
                            ? "extracted"
                            : track.source}
                    </Badge>
                  )}
                  {track.genre && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 hidden sm:inline-flex"
                    >
                      {track.genre}
                    </Badge>
                  )}
                  {track.usage_count != null && (
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {track.usage_count.toLocaleString()} uses
                    </span>
                  )}
                  {track.external_url && (
                    <a
                      href={track.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      <ArrowSquareOut className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reference Patterns */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Lightning className="h-4 w-4 text-muted-foreground" weight="fill" />
          <h2 className="text-sm font-medium">Reference Patterns</h2>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Patterns extracted from reference reels you've analyzed during trial
          reel generation.
        </p>

        {patternsLoading ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Loading patterns...
          </p>
        ) : !patternHistory || patternHistory.length === 0 ? (
          <div className="text-center py-6 rounded-lg border bg-muted/30">
            <p className="text-sm text-muted-foreground">
              No reference patterns yet. Analyze reference reels when generating
              trial variants to build pattern data.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {patternHistory.map((entry: ReferencePatternEntry) => {
              const p = entry.reference_patterns;
              const isExpanded = expandedPatternId === entry.id;

              return (
                <div
                  key={entry.id}
                  className="rounded-lg border bg-card overflow-hidden"
                >
                  <button
                    className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                    onClick={() =>
                      setExpandedPatternId(isExpanded ? null : entry.id)
                    }
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {p.summary.slice(0, 80)}
                        {p.summary.length > 80 ? "..." : ""}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(entry.created_at).toLocaleDateString()} ·{" "}
                        {entry.reference_urls?.length ?? 0} reference
                        {(entry.reference_urls?.length ?? 0) !== 1 ? "s" : ""}
                      </p>
                    </div>
                    {isExpanded ? (
                      <CaretUp className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                    ) : (
                      <CaretDown className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-3 border-t">
                      {/* Moods */}
                      {p.commonMoods?.length > 0 && (
                        <div className="pt-2.5">
                          <div className="flex flex-wrap gap-1">
                            {p.commonMoods.map((mood) => (
                              <Badge
                                key={mood}
                                variant="secondary"
                                className="text-[10px]"
                              >
                                {mood}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <PatternField label="Hook style" value={p.hookStyle} />
                        <PatternField
                          label="Avg duration"
                          value={`${p.avgDuration}s`}
                        />
                        <PatternField label="Pacing" value={p.pacingNotes} />
                        <PatternField label="Text style" value={p.textStyle} />
                        <PatternField
                          label="Structure"
                          value={p.structureNotes}
                        />
                        <PatternField label="Audio" value={p.audioNotes} />
                      </div>

                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                          Summary
                        </p>
                        <p className="text-xs text-foreground/80">
                          {p.summary}
                        </p>
                      </div>

                      {entry.reference_urls &&
                        entry.reference_urls.length > 0 && (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                              Sources
                            </p>
                            <div className="space-y-0.5">
                              {entry.reference_urls.map((url, i) => (
                                <a
                                  key={i}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] text-primary hover:underline truncate block"
                                >
                                  {url}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AddTrendingAudioDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={refresh}
      />
    </div>
  );
}

function PatternField({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p className="text-xs">{value}</p>
    </div>
  );
}
