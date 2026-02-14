import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { usePhrases } from "@/hooks/use-phrases";
import { useVideos } from "@/hooks/use-videos";
import { useMatches } from "@/hooks/use-matches";
import { useReels } from "@/hooks/use-reels";
import { PhraseCard } from "@/components/PhraseCard";
import { PhraseForm } from "@/components/PhraseForm";
import { BulkPhraseDialog } from "@/components/BulkPhraseDialog";
import { SuggestMatchesDialog } from "@/components/SuggestMatchesDialog";
import { NewReelDialog } from "@/components/NewReelDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  const { saveMatch } = useMatches();
  const { createReel, isCreating } = useReels();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Phrase | null>(null);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [matchPhrase, setMatchPhrase] = useState<Phrase | null>(null);
  const [showBulk, setShowBulk] = useState(false);
  const [reelPhrase, setReelPhrase] = useState<Phrase | null>(null);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    phrases.forEach(p => p.tags.forEach(t => s.add(t)));
    return Array.from(s).sort();
  }, [phrases]);

  const filtered = useMemo(() => {
    let result = phrases;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p => p.text.toLowerCase().includes(q) || p.tags.some(t => t.includes(q)));
    }
    if (activeTag) {
      result = result.filter(p => p.tags.includes(activeTag));
    }
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
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-lg font-semibold">Phrases</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New
              <CaretDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setEditing(null); setShowForm(true); }}>
              <TextT className="h-4 w-4 mr-2" />
              Single phrase
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowBulk(true)}>
              <ListPlus className="h-4 w-4 mr-2" />
              Bulk add
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {showForm && (
        <PhraseForm initial={editing} onSubmit={handleSubmit} onCancel={handleCancel} />
      )}

      <div className="relative">
        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search phrases..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {allTags.map(tag => (
            <Badge
              key={tag}
              variant={activeTag === tag ? "default" : "secondary"}
              className="text-xs cursor-pointer"
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          {phrases.length === 0 ? "No phrases yet. Add your first one!" : "No matches found."}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <PhraseCard
              key={p.id}
              phrase={p}
              onEdit={handleEdit}
              onDelete={deletePhrase}
              onFindMatches={setMatchPhrase}
              onBuildReel={setReelPhrase}
            />
          ))}
        </div>
      )}

      <SuggestMatchesDialog
        open={matchPhrase !== null}
        onOpenChange={(open) => !open && setMatchPhrase(null)}
        initialPhrase={matchPhrase}
        phrases={phrases}
        videos={videos}
        onSaveMatch={saveMatch}
      />

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
