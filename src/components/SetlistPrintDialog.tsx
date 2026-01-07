import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { jsPDF } from "jspdf";
import { Setlist } from "@/types";
import { Loader2, Printer, Download } from "lucide-react";

interface SetlistPrintDialogProps {
  open: boolean;
  onClose: () => void;
  setlist: Setlist | null;
}

export const SetlistPrintDialog = ({ open, onClose, setlist }: SetlistPrintDialogProps) => {
  const [options, setOptions] = useState({
    showArtist: true,
    showKey: true,
    showTempo: true,
    showNotes: true
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePDF = (action: 'print' | 'download') => {
    if (!setlist) return;
    setIsGenerating(true);

    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      // A4 dimensions: 210mm x 297mm
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 20;
      const contentHeight = pageHeight - (margin * 2);
      
      // Header/Footer allowance
      const headerHeight = 25; 
      const footerHeight = 15;
      const availableBodyHeight = contentHeight - headerHeight - footerHeight;

      // Filter empty sets if needed, or just print them as empty
      const setsToPrint = setlist.sets.sort((a, b) => a.position - b.position);

      setsToPrint.forEach((set, index) => {
        // Add page for subsequent sets
        if (index > 0) doc.addPage();

        // --- Header ---
        doc.setFontSize(24);
        doc.setFont("helvetica", "bold");
        doc.text(set.name, margin, margin + 10);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100);
        
        // Handle date properly
        const dateStr = setlist.created_at ? new Date(setlist.created_at).toLocaleDateString() : new Date().toLocaleDateString();
        doc.text(`${setlist.name} • ${dateStr}`, margin, margin + 18);
        doc.setTextColor(0); // Reset color

        // --- Footer ---
        doc.setFontSize(9);
        doc.setTextColor(150);
        doc.text(`Page ${index + 1} of ${setsToPrint.length}`, pageWidth / 2, pageHeight - 10, { align: "center" });
        doc.setTextColor(0);

        // --- Songs Content ---
        if (set.songs.length === 0) {
          doc.setFontSize(12);
          doc.setFont("helvetica", "italic");
          doc.setTextColor(150);
          doc.text("No songs in this set.", margin, margin + headerHeight + 10);
        } else {
          // Sort songs by position
          const songs = [...set.songs].sort((a, b) => a.position - b.position);

          // Calculate dynamic spacing
          const calculatedSlotHeight = availableBodyHeight / songs.length;
          const maxSlotHeight = 50; 
          const slotHeight = Math.min(calculatedSlotHeight, maxSlotHeight);
          
          const startY = margin + headerHeight;

          songs.forEach((item, songIndex) => {
            const song = item.song;
            if (!song) return;

            const currentY = startY + (songIndex * slotHeight);

            // 1. Song Title
            doc.setFontSize(18);
            doc.setFont("helvetica", "bold");
            const title = `${songIndex + 1}. ${song.title}`;
            doc.text(title, margin, currentY + 8);

            // 2. Meta Line (Artist, Key, Tempo) - Below Title
            const metaParts = [];
            if (options.showArtist && song.artist) metaParts.push(song.artist);
            if (options.showKey && song.key) metaParts.push(`Key: ${song.key}`);
            if (options.showTempo && song.tempo) metaParts.push(`${song.tempo} BPM`);

            if (metaParts.length > 0) {
               doc.setFontSize(11);
               doc.setFont("helvetica", "normal");
               doc.setTextColor(80);
               doc.text(metaParts.join("  •  "), margin + 8, currentY + 15);
               doc.setTextColor(0); // Reset
            }

            // 3. Note - Right Aligned Column
            if (options.showNotes && song.note) {
               doc.setFontSize(10);
               doc.setFont("helvetica", "italic");
               doc.setTextColor(100);
               
               const noteWidth = 65; // dedicated column width on right
               const noteX = pageWidth - margin - noteWidth; // Align start of text block
               
               // Split text to fit width
               const wrappedNote = doc.splitTextToSize(song.note, noteWidth);
               
               // For right alignment of multiline text, we need to calculate X based on the longest line or just use block
               // jsPDF text() with align: 'right' aligns the *end* of the text at the x coordinate.
               doc.text(wrappedNote, pageWidth - margin, currentY + 8, { align: "right" });
               
               doc.setTextColor(0); // Reset
            }
          });
        }
      });

      if (action === 'print') {
        doc.autoPrint();
        window.open(doc.output('bloburl'), '_blank');
      } else {
        doc.save(`${setlist.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
      }
      
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Print Setlist</DialogTitle>
          <DialogDescription>
            Configure what information to include in the PDF.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="artist" className="flex-1">Show Artist</Label>
            <Switch id="artist" checked={options.showArtist} onCheckedChange={(c) => setOptions(p => ({...p, showArtist: c}))} />
          </div>
          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="key" className="flex-1">Show Key</Label>
            <Switch id="key" checked={options.showKey} onCheckedChange={(c) => setOptions(p => ({...p, showKey: c}))} />
          </div>
          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="tempo" className="flex-1">Show Tempo</Label>
            <Switch id="tempo" checked={options.showTempo} onCheckedChange={(c) => setOptions(p => ({...p, showTempo: c}))} />
          </div>
          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="notes" className="flex-1">Show Notes</Label>
            <Switch id="notes" checked={options.showNotes} onCheckedChange={(c) => setOptions(p => ({...p, showNotes: c}))} />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="sm:mr-auto">Cancel</Button>
          <Button variant="secondary" onClick={() => generatePDF('download')} disabled={isGenerating}>
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Download PDF
          </Button>
          <Button onClick={() => generatePDF('print')} disabled={isGenerating}>
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};