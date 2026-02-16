import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/auth-context";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { BottomNav } from "@/components/BottomNav";
import { PullToRefresh } from "@/components/PullToRefresh";
import LoginPage from "@/pages/LoginPage";
import PhrasesPage from "@/pages/PhrasesPage";
import VideosPage from "@/pages/VideosPage";
import ReelsPage from "@/pages/ReelsPage";
import ReelBuilderPage from "@/pages/ReelBuilderPage";
import TrialBatchPage from "@/pages/TrialBatchPage";
import VideoDetailPage from "@/pages/VideoDetailPage";
import TrendsPage from "@/pages/TrendsPage";
import AccountPage from "@/pages/AccountPage";
import InstagramCallbackPage from "@/pages/InstagramCallbackPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <div className="min-h-screen bg-background text-foreground">
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="*" element={
                  <ProtectedRoute>
                    <PullToRefresh>
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
                        <Route path="/instagram/callback" element={
                          <main className="mx-auto max-w-lg px-4 pt-4 pb-20">
                            <InstagramCallbackPage />
                          </main>
                        } />
                        <Route path="/trials/:batchId" element={
                          <main className="mx-auto max-w-6xl px-4 pt-4 pb-20">
                            <TrialBatchPage />
                          </main>
                        } />
                        <Route path="*" element={
                          <main className="mx-auto max-w-lg px-4 pt-4 pb-20">
                            <Routes>
                              <Route path="/" element={<ReelsPage />} />
                              <Route path="/phrases" element={<PhrasesPage />} />
                              <Route path="/videos" element={<VideosPage />} />
                              <Route path="/trends" element={<TrendsPage />} />
                              <Route path="/account" element={<AccountPage />} />
                              <Route path="*" element={<NotFound />} />
                            </Routes>
                          </main>
                        } />
                      </Routes>
                    </PullToRefresh>
                    <BottomNav />
                  </ProtectedRoute>
                } />
              </Routes>
            </BrowserRouter>
        </div>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
