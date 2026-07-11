import { useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LENGTH_BUCKETS } from "@/lib/duration";
import type { Video } from "@/types/video";

export interface VideoFilters {
  type: string[];
  length: string[];
  mood: string[];
  energy: string[];
  pacing: string[];
  tags: string[];
  shotTypes: string[];
}

export const emptyFilters: VideoFilters = {
  type: [],
  length: [],
  mood: [],
  energy: [],
  pacing: [],
  tags: [],
  shotTypes: [],
};

interface FilterSectionProps {
  label: string;
  values: string[];
  selected: string[];
  onToggle: (value: string) => void;
  labelFor?: (value: string) => string;
}

function FilterSection({ label, values, selected, onToggle, labelFor }: FilterSectionProps) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</h3>
      <div className="flex flex-wrap gap-1">
        {values.map((v) => {
          const active = selected.includes(v);
          return (
            <Badge
              key={v}
              variant={active ? "default" : "outline"}
              className={`cursor-pointer select-none !text-[10px] !font-medium !px-2 !py-0.5 ${labelFor ? "" : "capitalize"}`}
              onClick={() => onToggle(v)}
            >
              {labelFor ? labelFor(v) : v}
            </Badge>
          );
        })}
      </div>
    </div>
  );
}

interface VideoFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: VideoFilters;
  onFiltersChange: (filters: VideoFilters) => void;
  videos: Video[];
}

function extractUniqueValues(videos: Video[]) {
  const types = new Set<string>();
  const moods = new Set<string>();
  const energies = new Set<string>();
  const pacings = new Set<string>();
  const tags = new Set<string>();
  const shotTypes = new Set<string>();

  for (const v of videos) {
    types.add(v.video_type);
    if (v.analysis) {
      if (v.analysis.mood) moods.add(v.analysis.mood.toLowerCase());
      if (v.analysis.energy) energies.add(v.analysis.energy.toLowerCase());
      if (v.analysis.pacing) pacings.add(v.analysis.pacing.toLowerCase());
      if (v.analysis.sceneTags) {
        for (const t of v.analysis.sceneTags) tags.add(t.toLowerCase());
      }
      if (v.analysis.shotTypes) {
        for (const s of v.analysis.shotTypes) shotTypes.add(s.toLowerCase());
      }
    }
  }

  return {
    types: Array.from(types).sort(),
    moods: Array.from(moods).sort(),
    energies: Array.from(energies).sort(),
    pacings: Array.from(pacings).sort(),
    tags: Array.from(tags).sort(),
    shotTypes: Array.from(shotTypes).sort(),
  };
}

export function VideoFilterSheet({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  videos,
}: VideoFilterSheetProps) {
  const unique = useMemo(() => extractUniqueValues(videos), [videos]);

  const toggle = (category: keyof VideoFilters, value: string) => {
    const current = filters[category];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onFiltersChange({ ...filters, [category]: next });
  };

  const sections: { label: string; key: keyof VideoFilters; values: string[] }[] = [
    { label: "Type", key: "type", values: unique.types },
    { label: "Mood", key: "mood", values: unique.moods },
    { label: "Energy", key: "energy", values: unique.energies },
    { label: "Pacing", key: "pacing", values: unique.pacings },
    { label: "Scene Tags", key: "tags", values: unique.tags },
    { label: "Shot Types", key: "shotTypes", values: unique.shotTypes },
  ];

  const visibleSections = sections.filter((s) => s.values.length >= 2);

  const hasDurations = videos.some((v) => v.duration_seconds != null);
  const lengthLabelFor = (value: string) =>
    LENGTH_BUCKETS.find((b) => b.value === value)?.label ?? value;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-2">
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-4 pb-4">
            {hasDurations && (
              <FilterSection
                label="Length"
                values={LENGTH_BUCKETS.map((b) => b.value)}
                selected={filters.length}
                onToggle={(value) => toggle("length", value)}
                labelFor={lengthLabelFor}
              />
            )}
            {visibleSections.length === 0 && !hasDurations ? (
              <p className="text-sm text-muted-foreground py-4">
                No filter options available yet. Analyze some videos to unlock filters.
              </p>
            ) : (
              visibleSections.map((s) => (
                <FilterSection
                  key={s.key}
                  label={s.label}
                  values={s.values}
                  selected={filters[s.key]}
                  onToggle={(value) => toggle(s.key, value)}
                />
              ))
            )}
          </div>
        </ScrollArea>

        <SheetFooter className="px-6 pb-6 pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => onFiltersChange(emptyFilters)}
          >
            Clear all
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
