import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Warning,
  CalendarBlank,
  ArrowRight,
} from "@phosphor-icons/react";
import type { PostingStrategy } from "@/types/posting-strategy";

const VARIANT_TYPE_COLORS: Record<string, string> = {
  text: "bg-purple-500/15 text-purple-700 border-purple-500/30",
  visual: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  audio: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  unknown: "bg-gray-500/15 text-gray-700 border-gray-500/30",
};

function scoreColor(score: number, invert = false): string {
  const effective = invert ? 100 - score : score;
  if (effective >= 70) return "text-green-600";
  if (effective >= 40) return "text-yellow-600";
  return "text-red-500";
}

function progressColor(score: number, invert = false): string {
  const effective = invert ? 100 - score : score;
  if (effective >= 70) return "[&>div]:bg-green-500";
  if (effective >= 40) return "[&>div]:bg-yellow-500";
  return "[&>div]:bg-red-500";
}

interface PostingStrategyPanelProps {
  strategy: PostingStrategy;
}

export function PostingStrategyPanel({ strategy }: PostingStrategyPanelProps) {
  const { slots, riskScore, confidenceScore, warnings } = strategy;

  return (
    <div className="space-y-4">
      {/* Scores */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              Risk Score
            </p>
            <span className={`text-sm font-bold ${scoreColor(riskScore, true)}`}>
              {riskScore}/100
            </span>
          </div>
          <Progress
            value={riskScore}
            className={`h-1.5 ${progressColor(riskScore, true)}`}
          />
          <p className="text-[10px] text-muted-foreground">
            {riskScore <= 35
              ? "Low — safe to post"
              : riskScore <= 60
                ? "Moderate — review spacing"
                : "High — consider changes"}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              Confidence
            </p>
            <span
              className={`text-sm font-bold ${scoreColor(confidenceScore)}`}
            >
              {confidenceScore}/100
            </span>
          </div>
          <Progress
            value={confidenceScore}
            className={`h-1.5 ${progressColor(confidenceScore)}`}
          />
          <p className="text-[10px] text-muted-foreground">
            {confidenceScore >= 70
              ? "Strong experiment clarity"
              : confidenceScore >= 40
                ? "Moderate — isolate more variables"
                : "Low — add variant diversity"}
          </p>
        </div>
      </div>

      {/* Cadence */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="secondary" className="text-xs">
          <CalendarBlank className="h-3 w-3 mr-1" />
          {strategy.cadenceDescription}
        </Badge>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-1.5">
          {warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-md bg-yellow-500/10 border border-yellow-500/20 px-3 py-2"
            >
              <Warning
                className="h-3.5 w-3.5 text-yellow-600 shrink-0 mt-0.5"
                weight="fill"
              />
              <p className="text-xs text-yellow-800">{w}</p>
            </div>
          ))}
        </div>
      )}

      {/* Posting timeline */}
      {slots.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Posting Calendar
          </p>
          <div className="space-y-0">
            {slots.map((slot, i) => {
              const typeColor =
                VARIANT_TYPE_COLORS[slot.variantType] ??
                VARIANT_TYPE_COLORS.unknown;

              return (
                <div key={slot.reelId}>
                  {/* Slot */}
                  <div className="flex gap-3 items-start">
                    {/* Timeline dot + line */}
                    <div className="flex flex-col items-center w-5 shrink-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary mt-1.5" />
                      {i < slots.length - 1 && (
                        <div className="w-px flex-1 bg-border min-h-[32px]" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-3 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-xs font-semibold">
                          {new Date(slot.date + "T12:00:00").toLocaleDateString(
                            undefined,
                            {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            }
                          )}
                        </p>
                        {slot.dayOffset === 0 && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0"
                          >
                            Today
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Badge
                          className={`text-[10px] border px-1.5 py-0 capitalize ${typeColor}`}
                        >
                          {slot.variantType}
                        </Badge>
                        <p className="text-xs truncate">{slot.variantLabel || slot.reelTitle}</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        {slot.rationale}
                      </p>

                      {/* Similarity connector to next */}
                      {slot.similarityToNext !== null && i < slots.length - 1 && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span
                            className={`text-[10px] font-medium ${
                              slot.similarityToNext > 0.6
                                ? "text-red-500"
                                : slot.similarityToNext > 0.3
                                  ? "text-yellow-600"
                                  : "text-green-600"
                            }`}
                          >
                            {Math.round(slot.similarityToNext * 100)}% similar
                            to next
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="rounded-lg bg-muted/50 border p-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {strategy.summaryRationale}
        </p>
      </div>
    </div>
  );
}
