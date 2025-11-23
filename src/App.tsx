import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import SongList from "./pages/SongList";
import SongEdit from "./pages/SongEdit";
import SongDetail from "./pages/SongDetail";
import Setlists from "./pages/Setlists";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/songs" element={<SongList />} />
          <Route path="/songs/new" element={<SongEdit />} />
          <Route path="/songs/:id" element={<SongDetail />} />
          <Route path="/songs/:id/edit" element={<SongEdit />} />
          <Route path="/setlists" element={<Setlists />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;