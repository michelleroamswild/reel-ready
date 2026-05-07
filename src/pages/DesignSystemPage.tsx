import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { MagnifyingGlass, Sparkle, Plus, VideoCamera } from "@phosphor-icons/react";

interface ColorSpec {
  name: string;
  token: string;
  hex: string;
  textOnIt?: string;
}

const colorRows: { group: string; colors: ColorSpec[] }[] = [
  {
    group: "Surface",
    colors: [
      { name: "Mist", token: "--mist", hex: "#ECECEE", textOnIt: "text-ink" },
      { name: "Surface", token: "--surface", hex: "#F5F5F7", textOnIt: "text-ink" },
      { name: "Surface 2", token: "--surface-2", hex: "#DADBE0", textOnIt: "text-ink" },
    ],
  },
  {
    group: "Ink",
    colors: [
      { name: "Ink", token: "--ink", hex: "#15161A", textOnIt: "text-mist" },
      { name: "Ink 2", token: "--ink-2", hex: "#2D2F36", textOnIt: "text-mist" },
      { name: "Muted", token: "--muted-strong", hex: "#6B6E78", textOnIt: "text-mist" },
    ],
  },
  {
    group: "Hairlines",
    colors: [
      { name: "Hairline", token: "--hairline", hex: "#D2D3D8", textOnIt: "text-ink" },
      { name: "Hairline strong", token: "--hairline-strong", hex: "#B7B9C1", textOnIt: "text-ink" },
      { name: "Muted 2", token: "--muted-2", hex: "#A2A4AD", textOnIt: "text-mist" },
    ],
  },
  {
    group: "Brand",
    colors: [
      { name: "Brand", token: "--brand", hex: "#E0277A", textOnIt: "text-mist" },
      { name: "Brand soft", token: "--brand-soft", hex: "#FBD9E7", textOnIt: "text-ink" },
      { name: "Brand ink", token: "--brand-ink", hex: "#F5F5F7", textOnIt: "text-ink" },
    ],
  },
];

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-5 pt-2">
      <header className="space-y-2 pb-3 border-b border-hairline">
        <span className="eyebrow">{eyebrow}</span>
        <h2 className="ed-display text-[36px] md:text-[44px] text-ink">{title}</h2>
      </header>
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
  const [switchOn, setSwitchOn] = useState(true);
  const [search, setSearch] = useState("");

  return (
    <div className="space-y-12 fade-up pb-12">
      {/* Page header */}
      <header className="space-y-3">
        <span className="eyebrow">ReelReady · v1.0</span>
        <h1 className="ed-display text-[56px] md:text-[88px] text-ink leading-[0.9]">
          Design system
        </h1>
        <p className="text-[14px] md:text-[15px] text-ink-2 max-w-xl leading-relaxed">
          A small, opinionated set of tokens and primitives. Editorial display, restrained accent,
          generous whitespace, and hairline detail.
        </p>
      </header>

      {/* COLOR */}
      <Section id="color" eyebrow="Foundations" title="Color">
        <div className="space-y-6">
          {colorRows.map((row) => (
            <div key={row.group} className="space-y-2">
              <p className="eyebrow-plain">{row.group}</p>
              <div className="grid grid-cols-3 gap-3">
                {row.colors.map((c) => (
                  <div key={c.token} className="rounded-xl overflow-hidden border border-hairline">
                    <div
                      className={`aspect-[5/3] flex flex-col justify-end p-3 ${c.textOnIt ?? "text-ink"}`}
                      style={{ background: c.hex }}
                    >
                      <p className="text-[13px] font-semibold tracking-tight">{c.name}</p>
                    </div>
                    <div className="flex items-center justify-between bg-surface px-3 py-2 text-[11px]">
                      <span className="font-mono text-muted-foreground">{c.token}</span>
                      <span className="font-mono text-ink-2 uppercase">{c.hex}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* TYPOGRAPHY */}
      <Section id="type" eyebrow="Foundations" title="Type">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-5">
            <p className="eyebrow-plain">Bricolage Grotesque · Display</p>
            <div className="space-y-4">
              <div>
                <p className="ed-display text-[64px] text-ink leading-[0.88]">Reels</p>
                <p className="text-[10.5px] font-mono text-muted-foreground mt-1">.ed-display · 64 / 800</p>
              </div>
              <div>
                <p className="ed-display text-[36px] text-ink leading-[0.95]">Sunday glow</p>
                <p className="text-[10.5px] font-mono text-muted-foreground mt-1">.ed-display · 36 / 800</p>
              </div>
              <div>
                <p className="ed-display text-[24px] text-ink leading-[1.1]">A late summer afternoon</p>
                <p className="text-[10.5px] font-mono text-muted-foreground mt-1">.ed-display · 24 / 800</p>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <p className="eyebrow-plain">Geist · Body & Mono</p>
            <div className="space-y-4">
              <div>
                <p className="text-[16px] leading-[1.45] text-ink">
                  The quiet pleasure of finding the right cut at the right moment.
                </p>
                <p className="text-[10.5px] font-mono text-muted-foreground mt-1">body · 16 / 400</p>
              </div>
              <div>
                <p className="text-[14px] leading-[1.45] text-ink-2">
                  Caption and metadata text use Geist at smaller sizes with comfortable leading.
                </p>
                <p className="text-[10.5px] font-mono text-muted-foreground mt-1">small · 14 / 400</p>
              </div>
              <div>
                <p className="text-[12px] text-muted-foreground">Caption · 12px / muted</p>
                <p className="text-[10.5px] font-mono text-muted-foreground mt-1">caption · 12 / 400</p>
              </div>
              <div>
                <p className="font-mono text-[11.5px] uppercase tracking-[0.04em] text-ink-2">
                  R-001 / 2026 / DRAFT
                </p>
                <p className="text-[10.5px] font-mono text-muted-foreground mt-1">mono · 11.5 / 500 / +0.04em</p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* TAGS & LABELS */}
      <Section id="tags" eyebrow="Pieces" title="Tags & labels">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="space-y-3">
            <p className="eyebrow-plain">Eyebrow</p>
            <div className="space-y-3">
              <div><span className="eyebrow">Library</span></div>
              <div><span className="eyebrow">AI Analysis<span className="accent-dot ml-1.5" /><span className="text-ink-2 ml-1">Confident</span></span></div>
              <div><span className="eyebrow-plain">Color palette</span></div>
            </div>
          </div>
          <div className="space-y-3">
            <p className="eyebrow-plain">Chip — pill</p>
            <div className="flex flex-wrap gap-2">
              <span className="chip">Default</span>
              <span className="chip chip-outline">Outline</span>
              <span className="chip chip-dark">Dark</span>
              <span className="chip chip-accent">Accent</span>
              <span className="chip chip-muted">Muted</span>
            </div>
          </div>
          <div className="space-y-3">
            <p className="eyebrow-plain">Badge</p>
            <div className="relative h-32 w-20 rounded-md overflow-hidden bg-ink">
              <span className="badge !bg-brand !text-brand-ink">Cloned</span>
              <span className="absolute bottom-2 left-2 right-2 text-[10px] text-white/80">Reel preview</span>
            </div>
          </div>
        </div>
      </Section>

      {/* BUTTONS */}
      <Section id="buttons" eyebrow="Pieces" title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button className="rounded-full bg-brand text-brand-ink hover:bg-brand/90 font-semibold h-9 px-4">
            <Plus className="h-4 w-4 mr-1" weight="bold" /> New
          </Button>
          <Button className="rounded-full h-9 px-4">Primary</Button>
          <Button variant="outline" className="h-9 rounded-full border-hairline-strong">Outline</Button>
          <Button variant="ghost" className="h-9 rounded-full">Ghost</Button>
          <button className="h-9 w-9 grid place-items-center rounded-full bg-ink text-mist">
            <Plus className="h-4 w-4" weight="bold" />
          </button>
          <button className="h-9 w-9 grid place-items-center rounded-full bg-surface-2 text-ink hover:bg-hairline transition-colors">
            <Sparkle className="h-4 w-4" weight="fill" />
          </button>
        </div>
      </Section>

      {/* COMPONENTS */}
      <Section id="components" eyebrow="Pieces" title="Components">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-hairline bg-surface px-4 py-3">
            <p className="eyebrow-plain mb-1.5">This week</p>
            <p className="ed-display text-[40px] text-ink leading-none">14</p>
            <p className="text-[11px] text-muted-foreground mt-1">+ 4 vs last</p>
          </div>

          <div className="rounded-xl border border-hairline bg-surface p-3 flex flex-col justify-center">
            <p className="eyebrow-plain mb-2">Search</p>
            <div className="flex items-center gap-2.5 px-3 h-9 rounded-full bg-mist border border-hairline">
              <MagnifyingGlass className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                placeholder="Search phrases…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent border-0 outline-none text-[13px] text-ink placeholder:text-muted-foreground/70"
              />
            </div>
          </div>

          <div className="rounded-xl border border-hairline bg-surface p-3 flex flex-col justify-center gap-2">
            <p className="eyebrow-plain">Switch</p>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-ink">Burn text on export</span>
              <Switch checked={switchOn} onCheckedChange={setSwitchOn} />
            </div>
          </div>

          <div>
            <p className="eyebrow-plain mb-2">Reel thumbnail</p>
            <div className="reel-thumb border border-hairline">
              <div className="w-full h-full thumb-placeholder grid place-items-center">
                <VideoCamera className="h-6 w-6 text-white/40" />
              </div>
              <div className="scrim-bottom" />
              <span className="badge !bg-brand !text-brand-ink">Cloned</span>
              <div className="meta">
                <p className="text-[11px] font-semibold text-white tracking-tight drop-shadow-sm">
                  Sunday glow
                </p>
                <p className="text-[10px] text-white/75 mt-0.5">18s · 4 clips</p>
              </div>
            </div>
          </div>

          <div className="md:col-span-2">
            <p className="eyebrow-plain mb-2">Phrase row</p>
            <div className="phrase-card hoverable">
              <div className="num">01</div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] leading-[1.45] tracking-tight text-ink">
                  The quiet pleasure of finding the right cut at the right moment.
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  <span className="chip chip-outline !text-[10.5px] !px-2 !py-1 !font-medium">calm</span>
                  <span className="chip chip-outline !text-[10.5px] !px-2 !py-1 !font-medium">editing</span>
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-3">
            <p className="eyebrow-plain mb-2">Color swatch group</p>
            <div className="flex flex-wrap gap-1.5">
              {["#E0277A", "#15161A", "#F5F5F7", "#FBD9E7", "#6B6E78", "#D2D3D8"].map((c) => (
                <div
                  key={c}
                  className="flex items-center gap-1.5 rounded-full border border-hairline bg-surface pr-2.5 pl-1 py-1"
                >
                  <span
                    className="h-5 w-5 rounded-full border border-black/10"
                    style={{ background: c }}
                  />
                  <span className="font-mono text-[11px] uppercase text-ink-2">{c}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* SPACING & RADIUS */}
      <Section id="spacing" eyebrow="Foundations" title="Radius & spacing">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <p className="eyebrow-plain">Radius</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "xs · 4", radius: "4px" },
                { label: "sm · 6", radius: "6px" },
                { label: "md · 10", radius: "10px" },
                { label: "lg · 14", radius: "14px" },
                { label: "xl · 22", radius: "22px" },
                { label: "pill · ∞", radius: "999px" },
              ].map((r) => (
                <div key={r.label} className="space-y-1.5">
                  <div className="aspect-square bg-ink" style={{ borderRadius: r.radius }} />
                  <p className="font-mono text-[10.5px] text-muted-foreground">{r.label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <p className="eyebrow-plain">Spacing scale</p>
            <div className="space-y-2">
              {[4, 8, 12, 16, 24, 32].map((s) => (
                <div key={s} className="flex items-center gap-3">
                  <div className="h-2 bg-ink rounded-full" style={{ width: `${s * 4}px` }} />
                  <p className="font-mono text-[10.5px] text-muted-foreground">{s}px</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
