
# ClipMatch — Short-Form Content Phrase & Video Tool

A clean, mobile-first app for managing phrases/statements and pairing them with video clips for short-form content creation (TikTok, Reels, Shorts).

## Phase 1: Phrase Database
- **Add/edit/delete phrases** with text, tags (e.g. "motivational", "funny", "dark humor"), and personal notes
- **Search & filter** phrases by text or tags
- **Simple list view** — minimal card-based UI, easy to scan on mobile

## Phase 2: Video Library
- **Upload videos** to cloud storage
- **Video gallery** with thumbnail previews
- **Basic video player** to preview uploaded content

## Phase 3: AI Video Analysis
- **Analyze uploaded videos** using AI (Lovable AI / Gemini) to identify good clip segments — based on visual changes, speech patterns, or energy shifts
- **AI suggests timestamps** for potential clips with brief descriptions of what's happening in each segment
- **Save clips** as bookmarked segments (start/end timestamps) linked to the source video

## Phase 4: Phrase ↔ Clip Matching
- **Select a phrase** and get AI-suggested clips that would pair well with it (based on mood, energy, pacing)
- **Match view** showing the phrase overlaid on a clip preview
- **Save pairings** for later use/export

## Design & UX
- **Mobile-first** with bottom navigation (Phrases, Videos, Matches)
- **Clean, minimal design** — no heavy styling, just functional
- **Dark mode default** (content creator friendly)
- **Backend**: Lovable Cloud for database, file storage, and AI edge functions
