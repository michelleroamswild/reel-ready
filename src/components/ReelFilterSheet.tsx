import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type ReelFilter = "all" | "cloned" | "matched";

interface ReelFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filter: ReelFilter;
  onFilterChange: (filter: ReelFilter) => void;
}

const options: { value: ReelFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "matched", label: "Matched" },
  { value: "cloned", label: "Cloned" },
];

export function ReelFilterSheet({
  open,
  onOpenChange,
  filter,
  onFilterChange,
}: ReelFilterSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-2">
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>

        <div className="flex-1 px-6">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Source</h3>
            <div className="flex flex-wrap gap-1.5">
              {options.map((opt) => (
                <Badge
                  key={opt.value}
                  variant={filter === opt.value ? "default" : "outline"}
                  className="cursor-pointer select-none"
                  onClick={() => onFilterChange(opt.value)}
                >
                  {opt.label}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <SheetFooter className="px-6 pb-6 pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => onFilterChange("all")}
          >
            Clear all
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
