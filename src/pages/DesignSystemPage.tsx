import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Toggle } from "@/components/ui/toggle";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  VideoCamera, ChatText, FilmStrip, TrendUp, UserCircle, Sparkle, Trash,
  ArrowLeft, ArrowRight, Check, X, Plus, MagnifyingGlass, Bell, Gear,
  Heart, Star, BookmarkSimple, Share, Download, Upload, Play, Pause,
  ArrowClockwise, Warning, Info, CheckCircle, WarningCircle, CircleNotch,
  PencilSimple, Copy, Export, MusicNote, Flask, Faders, CaretDown,
  UploadSimple, FilmReel, TextT, ListPlus, Tag, Lock, Eye, EyeSlash,
} from "@phosphor-icons/react";

// ─── Sidebar nav items ────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: "colors",       label: "Colors" },
  { id: "typography",   label: "Typography" },
  { id: "radius",       label: "Border Radius" },
  { id: "buttons",      label: "Buttons" },
  { id: "badges",       label: "Badges" },
  { id: "forms",        label: "Form Controls" },
  { id: "cards",        label: "Cards" },
  { id: "alerts",       label: "Alerts" },
  { id: "feedback",     label: "Feedback & Status" },
  { id: "navigation",   label: "Navigation" },
  { id: "overlays",     label: "Overlays" },
  { id: "scroll-area",  label: "Scroll Area" },
  { id: "icons",        label: "Icons" },
  { id: "separators",   label: "Separator" },
];

// ─── Section wrapper ──────────────────────────────────────────────────────

function Section({ id, title, description, children }: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="space-y-4 scroll-mt-20">
      <div>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      <div>{children}</div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  );
}

// ─── Color helpers ────────────────────────────────────────────────────────

function ColorSwatch({ name, variable }: { name: string; variable: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="h-14 w-full rounded-md border border-border" style={{ background: `hsl(var(${variable}))` }} />
      <div>
        <p className="text-xs font-medium text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground font-mono">{variable}</p>
      </div>
    </div>
  );
}

function ColorPair({ name, bg, fg }: { name: string; bg: string; fg: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="h-14 w-full rounded-md border border-border flex items-center justify-center text-xs font-medium"
        style={{ background: `hsl(var(${bg}))`, color: `hsl(var(${fg}))` }}
      >
        Aa
      </div>
      <div>
        <p className="text-xs font-medium text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground font-mono">{bg}</p>
      </div>
    </div>
  );
}

// ─── Radius demo ──────────────────────────────────────────────────────────

function RadiusSwatch({ label, className }: { label: string; className: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`h-16 w-16 bg-primary/20 border-2 border-primary ${className}`} />
      <span className="text-xs text-muted-foreground font-mono">{label}</span>
    </div>
  );
}

// ─── Icon grid item ───────────────────────────────────────────────────────

function IconItem({ icon: Icon, name }: { icon: React.ElementType; name: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border hover:bg-accent transition-colors">
      <Icon className="h-5 w-5 text-foreground" />
      <span className="text-xs text-muted-foreground text-center leading-tight">{name}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function DesignSystemPage() {
  const [sliderValue, setSliderValue] = useState([60]);
  const [switchOn, setSwitchOn] = useState(false);
  const [checked, setChecked] = useState(false);
  const [activeId, setActiveId] = useState<string>("colors");

  // Track which section is in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );

    NAV_ITEMS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex gap-10">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="hidden lg:block w-44 shrink-0">
        <nav className="sticky top-20 space-y-0.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 pb-2">
            On this page
          </p>
          {NAV_ITEMS.map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={cn(
                "block rounded-md px-3 py-1.5 text-sm transition-colors",
                activeId === id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              {label}
            </a>
          ))}
        </nav>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-14 pb-12">

        {/* Header */}
        <div className="border-b border-border pb-6 pt-10">
          <h1 className="text-3xl font-bold text-foreground">Design System</h1>
          <p className="text-muted-foreground mt-2 max-w-xl">
            All tokens, components, and patterns used across Reel Ready. Every element uses semantic color tokens and shared UI primitives.
          </p>
        </div>

        {/* ── Colors ──────────────────────────────────────────────────── */}
        <Section
          id="colors"
          title="Colors"
          description="Semantic color tokens from CSS custom properties. All colors adapt automatically between light and dark mode."
        >
          <div className="space-y-8">
            <SubSection title="Surface & Text">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-4">
                <ColorPair name="Background" bg="--background" fg="--foreground" />
                <ColorPair name="Card" bg="--card" fg="--card-foreground" />
                <ColorPair name="Popover" bg="--popover" fg="--popover-foreground" />
                <ColorSwatch name="Muted" variable="--muted" />
                <ColorSwatch name="Muted Foreground" variable="--muted-foreground" />
                <ColorSwatch name="Border" variable="--border" />
              </div>
            </SubSection>
            <SubSection title="Brand & Interactive">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-4">
                <ColorPair name="Primary" bg="--primary" fg="--primary-foreground" />
                <ColorPair name="Secondary" bg="--secondary" fg="--secondary-foreground" />
                <ColorPair name="Accent" bg="--accent" fg="--accent-foreground" />
                <ColorPair name="Destructive" bg="--destructive" fg="--destructive-foreground" />
                <ColorSwatch name="Input" variable="--input" />
                <ColorSwatch name="Ring" variable="--ring" />
              </div>
            </SubSection>
          </div>
        </Section>

        <Separator />

        {/* ── Typography ───────────────────────────────────────────────── */}
        <Section
          id="typography"
          title="Typography"
          description="Heading scale, body text, and font weight utilities."
        >
          <div className="space-y-8">
            <SubSection title="Heading Scale">
              <div className="space-y-3 border border-border rounded-lg p-6 bg-card">
                <p className="text-4xl font-bold text-foreground leading-tight">Display — text-4xl font-bold</p>
                <p className="text-3xl font-bold text-foreground leading-tight">Heading 1 — text-3xl font-bold</p>
                <p className="text-2xl font-semibold text-foreground leading-tight">Heading 2 — text-2xl font-semibold</p>
                <p className="text-xl font-semibold text-foreground leading-tight">Heading 3 — text-xl font-semibold</p>
                <p className="text-lg font-medium text-foreground leading-tight">Heading 4 — text-lg font-medium</p>
                <p className="text-base font-medium text-foreground leading-tight">Heading 5 — text-base font-medium</p>
                <p className="text-sm font-medium text-foreground leading-tight">Heading 6 — text-sm font-medium</p>
              </div>
            </SubSection>
            <SubSection title="Body Text">
              <div className="space-y-2 border border-border rounded-lg p-6 bg-card">
                <p className="text-base text-foreground">Base (text-base) — The quick brown fox jumps over the lazy dog.</p>
                <p className="text-sm text-foreground">Small (text-sm) — The quick brown fox jumps over the lazy dog.</p>
                <p className="text-xs text-foreground">X-Small (text-xs) — The quick brown fox jumps over the lazy dog.</p>
                <p className="text-sm text-muted-foreground">Muted — Supporting text, descriptions, captions.</p>
                <p className="text-sm text-primary">Primary — Highlighted or interactive text.</p>
                <p className="text-sm text-destructive">Destructive — Errors and warnings.</p>
              </div>
            </SubSection>
            <SubSection title="Font Weights">
              <div className="flex flex-wrap gap-8 border border-border rounded-lg p-6 bg-card">
                {(["font-normal", "font-medium", "font-semibold", "font-bold"] as const).map((w) => (
                  <div key={w} className="space-y-1">
                    <p className={`text-2xl text-foreground ${w}`}>Aa</p>
                    <p className="text-xs text-muted-foreground font-mono">{w}</p>
                  </div>
                ))}
              </div>
            </SubSection>
          </div>
        </Section>

        <Separator />

        {/* ── Border Radius ─────────────────────────────────────────────── */}
        <Section
          id="radius"
          title="Border Radius"
          description="Radius scale derived from --radius (0.75rem / 12px)."
        >
          <div className="flex flex-wrap gap-8 border border-border rounded-lg p-6 bg-card">
            <RadiusSwatch label="rounded-none" className="rounded-none" />
            <RadiusSwatch label="rounded-sm"   className="rounded-sm" />
            <RadiusSwatch label="rounded-md"   className="rounded-md" />
            <RadiusSwatch label="rounded-lg"   className="rounded-lg" />
            <RadiusSwatch label="rounded-xl"   className="rounded-xl" />
            <RadiusSwatch label="rounded-full" className="rounded-full" />
          </div>
        </Section>

        <Separator />

        {/* ── Buttons ───────────────────────────────────────────────────── */}
        <Section id="buttons" title="Buttons" description="All variants and sizes from button.tsx.">
          <div className="space-y-6 border border-border rounded-lg p-6 bg-card">
            <SubSection title="Variants">
              <div className="flex flex-wrap gap-3">
                <Button variant="default">Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="link">Link</Button>
              </div>
            </SubSection>
            <SubSection title="Sizes">
              <div className="flex flex-wrap items-center gap-3">
                <Button size="lg">Large</Button>
                <Button size="default">Default</Button>
                <Button size="sm">Small</Button>
                <Button size="icon"><Plus /></Button>
              </div>
            </SubSection>
            <SubSection title="With Icons">
              <div className="flex flex-wrap gap-3">
                <Button><Plus className="h-4 w-4" />Add clip</Button>
                <Button variant="outline"><Export className="h-4 w-4" />Export</Button>
                <Button variant="secondary"><Sparkle className="h-4 w-4" />Generate</Button>
                <Button variant="destructive"><Trash className="h-4 w-4" />Delete</Button>
              </div>
            </SubSection>
            <SubSection title="States">
              <div className="flex flex-wrap gap-3">
                <Button disabled>Disabled</Button>
                <Button variant="outline" disabled>Disabled outline</Button>
                <Button><CircleNotch className="h-4 w-4 animate-spin" />Loading</Button>
              </div>
            </SubSection>
          </div>
        </Section>

        <Separator />

        {/* ── Badges ────────────────────────────────────────────────────── */}
        <Section id="badges" title="Badges" description="All variants from badge.tsx.">
          <div className="flex flex-wrap gap-3 border border-border rounded-lg p-6 bg-card">
            <Badge variant="default">Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="default"><Sparkle className="h-3 w-3 mr-1" />AI</Badge>
            <Badge variant="secondary"><Check className="h-3 w-3 mr-1" />Done</Badge>
            <Badge variant="destructive"><Warning className="h-3 w-3 mr-1" />Error</Badge>
          </div>
        </Section>

        <Separator />

        {/* ── Form Controls ─────────────────────────────────────────────── */}
        <Section
          id="forms"
          title="Form Controls"
          description="Inputs, selects, checkboxes, switches, and other form elements."
        >
          <div className="space-y-8 border border-border rounded-lg p-6 bg-card">
            <SubSection title="Text Inputs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                <div className="space-y-1.5">
                  <Label htmlFor="ds-input-default">Default input</Label>
                  <Input id="ds-input-default" placeholder="Enter text…" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ds-input-disabled">Disabled</Label>
                  <Input id="ds-input-disabled" placeholder="Cannot edit" disabled />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ds-textarea">Textarea</Label>
                  <Textarea id="ds-textarea" placeholder="Multi-line input…" rows={3} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ds-select">Select</Label>
                  <Select>
                    <SelectTrigger id="ds-select">
                      <SelectValue placeholder="Pick an option" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reels">Reels</SelectItem>
                      <SelectItem value="videos">Videos</SelectItem>
                      <SelectItem value="phrases">Phrases</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </SubSection>
            <SubSection title="Toggles & Checks">
              <div className="flex flex-wrap gap-8">
                <div className="flex items-center gap-2">
                  <Checkbox id="ds-cb" checked={checked} onCheckedChange={(v) => setChecked(!!v)} />
                  <Label htmlFor="ds-cb">Checkbox</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="ds-cb-checked" defaultChecked />
                  <Label htmlFor="ds-cb-checked">Checked</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="ds-switch" checked={switchOn} onCheckedChange={setSwitchOn} />
                  <Label htmlFor="ds-switch">Switch {switchOn ? "on" : "off"}</Label>
                </div>
                <div className="flex gap-2">
                  <Toggle aria-label="bold" size="sm">Bold</Toggle>
                  <Toggle aria-label="italic" size="sm" defaultPressed>Italic</Toggle>
                </div>
              </div>
            </SubSection>
            <SubSection title="Radio Group">
              <RadioGroup defaultValue="reels" className="flex gap-6">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="reels" id="r-reels" />
                  <Label htmlFor="r-reels">Reels</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="videos" id="r-videos" />
                  <Label htmlFor="r-videos">Videos</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="phrases" id="r-phrases" />
                  <Label htmlFor="r-phrases">Phrases</Label>
                </div>
              </RadioGroup>
            </SubSection>
            <SubSection title="Slider">
              <div className="max-w-sm space-y-2">
                <Label>Volume — {sliderValue[0]}%</Label>
                <Slider value={sliderValue} onValueChange={setSliderValue} min={0} max={100} step={1} />
              </div>
            </SubSection>
          </div>
        </Section>

        <Separator />

        {/* ── Cards ─────────────────────────────────────────────────────── */}
        <Section id="cards" title="Cards" description="Card layout with all sub-components.">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Summer Reel</CardTitle>
                <CardDescription>3 clips · 24s · Created Apr 2025</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-32 rounded-md bg-muted flex items-center justify-center">
                  <FilmStrip className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
              <CardFooter className="gap-2">
                <Button size="sm" variant="outline" className="flex-1"><Play className="h-4 w-4" />Preview</Button>
                <Button size="sm" className="flex-1"><Export className="h-4 w-4" />Export</Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>Phrase Bank</CardTitle>
                    <CardDescription>42 phrases saved</CardDescription>
                  </div>
                  <Badge variant="secondary">Active</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {["Summer vibes ✨", "Golden hour 🌅", "Adventure awaits 🌿"].map((p) => (
                  <div key={p} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ChatText className="h-3.5 w-3.5 shrink-0" />
                    {p}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Analytics</CardTitle>
                <CardDescription>Last 30 days</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "Views", value: "12.4k", delta: "+18%" },
                  { label: "Saves", value: "840",   delta: "+5%"  },
                  { label: "Shares", value: "312",  delta: "+22%" },
                ].map((s) => (
                  <div key={s.label} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{s.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{s.value}</span>
                      <Badge variant="outline" className="text-xs">{s.delta}</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </Section>

        <Separator />

        {/* ── Alerts ────────────────────────────────────────────────────── */}
        <Section id="alerts" title="Alerts" description="Alert components for status messages.">
          <div className="space-y-3 max-w-2xl">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Default alert</AlertTitle>
              <AlertDescription>Your reel has been saved and is ready to export.</AlertDescription>
            </Alert>
            <Alert variant="destructive">
              <WarningCircle className="h-4 w-4" />
              <AlertTitle>Export failed</AlertTitle>
              <AlertDescription>There was a problem exporting your reel. Please try again.</AlertDescription>
            </Alert>
          </div>
        </Section>

        <Separator />

        {/* ── Feedback & Status ─────────────────────────────────────────── */}
        <Section id="feedback" title="Feedback & Status" description="Avatars, progress bars, and skeleton loaders.">
          <div className="space-y-8 border border-border rounded-lg p-6 bg-card">
            <SubSection title="Avatars">
              <div className="flex flex-wrap gap-6 items-end">
                {[
                  { size: "h-8 w-8",  fallback: "SM", label: "Small" },
                  { size: "h-10 w-10", fallback: "MD", label: "Default" },
                  { size: "h-12 w-12", fallback: "MT", label: "Medium" },
                  { size: "h-16 w-16", fallback: "LG", label: "Large" },
                ].map(({ size, fallback, label }) => (
                  <div key={label} className="flex flex-col items-center gap-1.5">
                    <Avatar className={size}>
                      <AvatarFallback className="text-xs">{fallback}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </SubSection>
            <SubSection title="Progress">
              <div className="space-y-3 max-w-md">
                <Progress value={25} />
                <Progress value={60} />
                <Progress value={100} />
              </div>
            </SubSection>
            <SubSection title="Skeleton">
              <div className="space-y-3 max-w-sm">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                <Skeleton className="h-32 w-full rounded-md" />
              </div>
            </SubSection>
          </div>
        </Section>

        <Separator />

        {/* ── Navigation ───────────────────────────────────────────────── */}
        <Section id="navigation" title="Navigation Patterns" description="Tabs and accordion components.">
          <div className="space-y-6">
            <SubSection title="Tabs">
              <Tabs defaultValue="reels" className="max-w-lg">
                <TabsList className="w-full">
                  <TabsTrigger value="reels"   className="flex-1">Reels</TabsTrigger>
                  <TabsTrigger value="videos"  className="flex-1">Videos</TabsTrigger>
                  <TabsTrigger value="phrases" className="flex-1">Phrases</TabsTrigger>
                </TabsList>
                <TabsContent value="reels"   className="border border-border rounded-lg p-4 text-sm text-muted-foreground">Reel content would appear here.</TabsContent>
                <TabsContent value="videos"  className="border border-border rounded-lg p-4 text-sm text-muted-foreground">Video library content would appear here.</TabsContent>
                <TabsContent value="phrases" className="border border-border rounded-lg p-4 text-sm text-muted-foreground">Phrase bank content would appear here.</TabsContent>
              </Tabs>
            </SubSection>
            <SubSection title="Accordion">
              <Accordion type="single" collapsible className="max-w-lg border border-border rounded-lg px-4">
                <AccordionItem value="item-1">
                  <AccordionTrigger>What is a Reel?</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    A reel is a short-form video composed of clips, captions, and audio stitched together in sequence.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                  <AccordionTrigger>How do I export?</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    Tap the Export button in the reel builder to download your finished video.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-3" className="border-b-0">
                  <AccordionTrigger>Can I schedule posts?</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    Scheduling is coming soon. For now you can export and post directly to Instagram.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </SubSection>
          </div>
        </Section>

        <Separator />

        {/* ── Overlays ─────────────────────────────────────────────────── */}
        <Section id="overlays" title="Overlays & Popovers" description="Tooltip, Dialog, Popover, and Sheet.">
          <div className="flex flex-wrap gap-3 border border-border rounded-lg p-6 bg-card">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline">Hover for tooltip</Button>
              </TooltipTrigger>
              <TooltipContent>This is a tooltip</TooltipContent>
            </Tooltip>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Open Dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete reel?</DialogTitle>
                  <DialogDescription>
                    This will permanently delete your reel and all its clips. This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline">Cancel</Button>
                  <Button variant="destructive"><Trash className="h-4 w-4" />Delete</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">Open Popover</Button>
              </PopoverTrigger>
              <PopoverContent className="w-72">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Filter reels</p>
                  <p className="text-xs text-muted-foreground">Narrow down by date, status, or tag.</p>
                </div>
              </PopoverContent>
            </Popover>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">Open Sheet</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Settings</SheetTitle>
                  <SheetDescription>Manage your preferences here.</SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Dark mode</Label>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Notifications</Label>
                    <Switch defaultChecked />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </Section>

        <Separator />

        {/* ── Scroll Area ──────────────────────────────────────────────── */}
        <Section id="scroll-area" title="Scroll Area" description="Custom scrollable container with styled scrollbar.">
          <ScrollArea className="h-40 max-w-xs rounded-md border border-border p-4">
            <div className="space-y-2">
              {Array.from({ length: 12 }, (_, i) => (
                <p key={i} className="text-sm text-muted-foreground">
                  Clip {i + 1} — beach_sunset_0{String(i + 1).padStart(2, "0")}.mp4
                </p>
              ))}
            </div>
          </ScrollArea>
        </Section>

        <Separator />

        {/* ── Icons ────────────────────────────────────────────────────── */}
        <Section id="icons" title="Icons" description="Phosphor Icons used across the app. Supports 6 weight variants.">
          <div className="space-y-6 border border-border rounded-lg p-6 bg-card">
            <SubSection title="Navigation & Actions">
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 xl:grid-cols-10 gap-2">
                <IconItem icon={VideoCamera}    name="VideoCamera" />
                <IconItem icon={FilmStrip}      name="FilmStrip" />
                <IconItem icon={ChatText}       name="ChatText" />
                <IconItem icon={TrendUp}        name="TrendUp" />
                <IconItem icon={UserCircle}     name="UserCircle" />
                <IconItem icon={Plus}           name="Plus" />
                <IconItem icon={X}              name="X" />
                <IconItem icon={Check}          name="Check" />
                <IconItem icon={ArrowLeft}      name="ArrowLeft" />
                <IconItem icon={ArrowRight}     name="ArrowRight" />
                <IconItem icon={ArrowClockwise} name="ArrowClockwise" />
                <IconItem icon={MagnifyingGlass} name="MagnifyingGlass" />
                <IconItem icon={CaretDown}      name="CaretDown" />
                <IconItem icon={Faders}         name="Faders" />
                <IconItem icon={Gear}           name="Gear" />
                <IconItem icon={Bell}           name="Bell" />
              </div>
            </SubSection>
            <SubSection title="Content & Media">
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 xl:grid-cols-10 gap-2">
                <IconItem icon={Play}         name="Play" />
                <IconItem icon={Pause}        name="Pause" />
                <IconItem icon={Export}       name="Export" />
                <IconItem icon={Download}     name="Download" />
                <IconItem icon={Upload}       name="Upload" />
                <IconItem icon={UploadSimple} name="UploadSimple" />
                <IconItem icon={Copy}         name="Copy" />
                <IconItem icon={Share}        name="Share" />
                <IconItem icon={MusicNote}    name="MusicNote" />
                <IconItem icon={FilmReel}     name="FilmReel" />
                <IconItem icon={PencilSimple} name="PencilSimple" />
                <IconItem icon={Trash}        name="Trash" />
                <IconItem icon={TextT}        name="TextT" />
                <IconItem icon={ListPlus}     name="ListPlus" />
                <IconItem icon={Tag}          name="Tag" />
                <IconItem icon={BookmarkSimple} name="BookmarkSimple" />
              </div>
            </SubSection>
            <SubSection title="Status & Feedback">
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 xl:grid-cols-10 gap-2">
                <IconItem icon={Sparkle}       name="Sparkle" />
                <IconItem icon={Flask}         name="Flask" />
                <IconItem icon={CheckCircle}   name="CheckCircle" />
                <IconItem icon={WarningCircle} name="WarningCircle" />
                <IconItem icon={Warning}       name="Warning" />
                <IconItem icon={Info}          name="Info" />
                <IconItem icon={CircleNotch}   name="CircleNotch" />
                <IconItem icon={Heart}         name="Heart" />
                <IconItem icon={Star}          name="Star" />
                <IconItem icon={Lock}          name="Lock" />
                <IconItem icon={Eye}           name="Eye" />
                <IconItem icon={EyeSlash}      name="EyeSlash" />
              </div>
            </SubSection>
            <SubSection title="Icon Sizes">
              <div className="flex flex-wrap items-end gap-8">
                {[
                  ["h-3 w-3",  "12px"],
                  ["h-4 w-4",  "16px"],
                  ["h-5 w-5",  "20px"],
                  ["h-6 w-6",  "24px"],
                  ["h-8 w-8",  "32px"],
                ].map(([cls, label]) => (
                  <div key={cls} className="flex flex-col items-center gap-2">
                    <VideoCamera className={`${cls} text-foreground`} />
                    <span className="text-xs text-muted-foreground font-mono">{label}</span>
                  </div>
                ))}
              </div>
            </SubSection>
            <SubSection title="Icon Weights">
              <div className="flex flex-wrap gap-6">
                {(["thin", "light", "regular", "bold", "fill", "duotone"] as const).map((w) => (
                  <div key={w} className="flex flex-col items-center gap-2">
                    <VideoCamera className="h-6 w-6 text-foreground" weight={w} />
                    <span className="text-xs text-muted-foreground font-mono">{w}</span>
                  </div>
                ))}
              </div>
            </SubSection>
          </div>
        </Section>

        <Separator />

        {/* ── Separator ────────────────────────────────────────────────── */}
        <Section id="separators" title="Separator" description="Horizontal and vertical dividers.">
          <div className="border border-border rounded-lg p-6 bg-card space-y-6">
            <div className="space-y-3 max-w-xs">
              <p className="text-sm text-muted-foreground">Above the separator</p>
              <Separator />
              <p className="text-sm text-muted-foreground">Below the separator</p>
            </div>
            <div className="flex items-center gap-4 max-w-xs">
              <span className="text-sm text-muted-foreground">Left</span>
              <Separator orientation="vertical" className="h-6" />
              <span className="text-sm text-muted-foreground">Right</span>
            </div>
          </div>
        </Section>

      </div>
    </div>
  );
}
