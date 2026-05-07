import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/auth-context";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { BottomNav } from "@/components/BottomNav";
import { SideNav } from "@/components/SideNav";
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
import TemplatesPage from "@/pages/TemplatesPage";
import TemplateDetailPage from "@/pages/TemplateDetailPage";
import InstagramCallbackPage from "@/pages/InstagramCallbackPage";
import DesignSystemPage from "@/pages/DesignSystemPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  // Mobile: full width with bottom padding for BottomNav
  // Desktop: page content sits in the right column beside the sidebar; editorial padding
  const mainPagesClass = "mx-auto max-w-lg px-4 pt-6 pb-24 md:max-w-[1400px] md:px-10 md:pt-10 md:pb-12";
  const wideClass = "mx-auto max-w-lg px-4 pt-6 pb-24 md:max-w-[1400px] md:px-10 md:pt-10 md:pb-12";
  const medClass = "mx-auto max-w-4xl px-4 pt-6 pb-24 md:px-10 md:pt-10 md:pb-12";
  const narrowClass = "mx-auto max-w-lg px-4 pt-6 pb-24 md:max-w-2xl md:px-10 md:pt-10 md:pb-12";

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={
        <ProtectedRoute>
          <div className="min-h-screen flex bg-mist">
            <SideNav />
            <div className="flex-1 min-w-0">
              <PullToRefresh>
                <Routes>
                  <Route path="/videos/:id" element={
                    <main className={medClass}>
                      <VideoDetailPage />
                    </main>
                  } />
                  <Route path="/reels/:id" element={
                    <main className={wideClass}>
                      <ReelBuilderPage />
                    </main>
                  } />
                  <Route path="/instagram/callback" element={
                    <main className={narrowClass}>
                      <InstagramCallbackPage />
                    </main>
                  } />
                  <Route path="/templates/:id" element={
                    <main className={narrowClass}>
                      <TemplateDetailPage />
                    </main>
                  } />
                  <Route path="/trials/:batchId" element={
                    <main className={wideClass}>
                      <TrialBatchPage />
                    </main>
                  } />
                  <Route path="*" element={
                    <main className={mainPagesClass}>
                      <Routes>
                        <Route path="/" element={<ReelsPage />} />
                        <Route path="/phrases" element={<PhrasesPage />} />
                        <Route path="/videos" element={<VideosPage />} />
                        <Route path="/templates" element={<TemplatesPage />} />
                        <Route path="/trends" element={<TrendsPage />} />
                        <Route path="/account" element={<AccountPage />} />
                        <Route path="/design-system" element={<DesignSystemPage />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </main>
                  } />
                </Routes>
              </PullToRefresh>
            </div>
            <BottomNav />
          </div>
        </ProtectedRoute>
      } />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
