import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import PhrasesPage from "@/pages/PhrasesPage";
import VideosPage from "@/pages/VideosPage";
import MatchesPage from "@/pages/MatchesPage";
import ReelsPage from "@/pages/ReelsPage";
import ReelBuilderPage from "@/pages/ReelBuilderPage";
import VideoDetailPage from "@/pages/VideoDetailPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <div className="min-h-screen bg-background text-foreground">
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/videos/:id" element={
                <main className="mx-auto max-w-4xl px-4 pt-4 pb-20">
                  <VideoDetailPage />
                </main>
              } />
              <Route path="/reels/:id" element={
                <main className="mx-auto max-w-6xl px-4 pt-4 pb-20">
                  <ReelBuilderPage />
                </main>
              } />
              <Route path="*" element={
                <main className="mx-auto max-w-lg px-4 pt-4 pb-20">
                  <Routes>
                    <Route path="/" element={<PhrasesPage />} />
                    <Route path="/videos" element={<VideosPage />} />
                    <Route path="/matches" element={<MatchesPage />} />
                    <Route path="/reels" element={<ReelsPage />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </main>
              } />
            </Routes>
            <BottomNav />
          </BrowserRouter>
      </div>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
