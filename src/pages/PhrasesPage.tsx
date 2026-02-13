import { useState, useMemo } from "react";
import { usePhrases } from "@/hooks/use-phrases";
import { useVideos } from "@/hooks/use-videos";
import { useMatches } from "@/hooks/use-matches";
import { PhraseCard } from "@/components/PhraseCard";
import { PhraseForm } from "@/components/PhraseForm";
import { SuggestMatchesDialog } from "@/components/SuggestMatchesDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, MagnifyingGlass } from "@phosphor-icons/react";
import type { Phrase } from "@/types/phrase";

export default function PhrasesPage() {
  const { phrases, isLoading, addPhrase, updatePhrase, deletePhrase } = usePhrases();
  const { videos } = useVideos();
  const { saveMatch } = useMatches();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Phrase | null>(null);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [matchPhrase, setMatchPhrase] = useState<Phrase | null>(null);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Phrases</h1>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-1" /> New
        </Button>
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
    </div>
  );
}
