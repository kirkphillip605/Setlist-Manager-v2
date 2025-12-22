import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface LoadingDialogProps {
  open: boolean;
  message?: string;
}

export const LoadingDialog = ({ open, message = "Saving changes..." }: LoadingDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[300px] flex flex-col items-center justify-center py-10 outline-none [&>button]:hidden pointer-events-none">
        {/* Hidden title/description for accessibility compliance */}
        <div className="sr-only">
            <DialogTitle>Loading</DialogTitle>
            <DialogDescription>{message}</DialogDescription>
        </div>
        <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
        <h3 className="text-lg font-semibold">{message}</h3>
        <p className="text-sm text-muted-foreground">Please wait...</p>
      </DialogContent>
    </Dialog>
  );
};