import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { usePhrases } from "@/hooks/use-phrases";
import { useVideos } from "@/hooks/use-videos";
import { useReels } from "@/hooks/use-reels";
import { PhraseCard } from "@/components/PhraseCard";
import { PhraseForm } from "@/components/PhraseForm";
import { BulkPhraseDialog } from "@/components/BulkPhraseDialog";
import { NewReelDialog } from "@/components/NewReelDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Plus, CaretDown, TextT, ListPlus, MagnifyingGlass } from "@phosphor-icons/react";
import type { Phrase } from "@/types/phrase";

export default function PhrasesPage() {
  const navigate = useNavigate();
  const { phrases, isLoading, addPhrase, updatePhrase, deletePhrase } = usePhrases();
  const { videos } = useVideos();
  const { createReel, isCreating } = useReels();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Phrase | null>(null);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [showBulk, setShowBulk] = useState(false);
  const [reelPhrase, setReelPhrase] = useState<Phrase | null>(null);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    phrases.forEach((p) => p.tags.forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [phrases]);

  const filtered = useMemo(() => {
    let result = phrases;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((p) => p.text.toLowerCase().includes(q) || p.tags.some((t) => t.includes(q)));
    }
    if (activeTag) result = result.filter((p) => p.tags.includes(activeTag));
    return result;
  }, [phrases, search, activeTag]);

  const handleSubmit = (text: string, tags: string[], notes: string) => {
    if (editing) {
      updatePhrase(editing.id, { text, tags, notes });
      setEditing(null);
    } else {
      addPhrase(text, tags, notes);
    }
    setShowForm(false);
  };

  const handleEdit = (phrase: Phrase) => {
    setEditing(phrase);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditing(null);
  };

  const handleBuildReel = async (phrase: Phrase, title: string, targetDuration: number) => {
    try {
      const reelId = await createReel({ phrase, title, targetDuration, videos });
      setReelPhrase(null);
      navigate(`/reels/${reelId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast({
        variant: "destructive",
        title: "Failed to build reel",
        description: message,
      });
    }
  };

  return (
    <div className="space-y-6 fade-up">
      {/* Editorial header */}
      <header className="space-y-3 pb-1">
        <span className="eyebrow">Voice</span>
        <div className="flex items-end justify-between gap-4">
          <h1 className="ed-display text-[44px] md:text-[64px] text-ink">Phrases</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="rounded-full bg-brand text-brand-ink hover:bg-brand/90 font-semibold h-9 px-4 shrink-0">
                <Plus className="h-4 w-4 mr-1" weight="bold" /> New
                <CaretDown className="h-3 w-3 ml-1.5 opacity-80" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { setEditing(null); setShowForm(true); }}>
                <TextT className="h-4 w-4 mr-2" /> Single phrase
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowBulk(true)}>
                <ListPlus className="h-4 w-4 mr-2" /> Bulk add
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="text-[13px] text-muted-foreground">
          {phrases.length} phrase{phrases.length !== 1 ? "s" : ""} · {allTags.length} tag{allTags.length !== 1 ? "s" : ""}
        </p>
      </header>

      {showForm && <PhraseForm initial={editing} onSubmit={handleSubmit} onCancel={handleCancel} />}

      {/* Search */}
      <div className="flex items-center gap-2.5 px-4 h-11 rounded-full bg-surface border border-hairline focus-within:border-hairline-strong transition-colors">
        <MagnifyingGlass className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          placeholder="Search phrases…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent border-0 outline-none text-[14px] text-ink placeholder:text-muted-foreground/70"
        />
      </div>

      {/* Tag rail */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveTag(null)}
            className={`chip ${activeTag === null ? "chip-dark" : "chip-outline"}`}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`chip ${activeTag === tag ? "chip-dark" : "chip-outline"}`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-12">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-[13px] text-muted-foreground text-center py-12">
          {phrases.length === 0 ? "No phrases yet. Add your first one." : "No matches found."}
        </p>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((p, i) => (
            <PhraseCard
              key={p.id}
              phrase={p}
              index={i}
              onEdit={handleEdit}
              onDelete={deletePhrase}
              onBuildReel={setReelPhrase}
            />
          ))}
        </div>
      )}

      <BulkPhraseDialog
        open={showBulk}
        onOpenChange={setShowBulk}
        onSubmit={(items) => items.forEach((p) => addPhrase(p.text, p.tags, p.notes))}
      />

      <NewReelDialog
        open={reelPhrase !== null}
        onOpenChange={(open) => !open && setReelPhrase(null)}
        phrases={phrases}
        initialPhrase={reelPhrase}
        onSubmit={handleBuildReel}
        isSubmitting={isCreating}
      />
    </div>
  );
}
