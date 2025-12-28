import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

interface LoadingDialogProps {
  open: boolean;
  message?: string;
}

export const LoadingDialog = ({ open, message = "Saving changes..." }: LoadingDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogPortal>
        {/* Custom overlay with pointer-events-none */}
        <DialogOverlay className="pointer-events-none" />
        <DialogPrimitive.Content 
          className="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] pointer-events-none"
        >
          <div className="sm:max-w-[300px] flex flex-col items-center justify-center py-10 bg-background rounded-lg border shadow-lg px-6">
            {/* Hidden title/description for accessibility compliance */}
            <div className="sr-only">
              <DialogTitle>Loading</DialogTitle>
              <DialogDescription>{message}</DialogDescription>
            </div>
            <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
            <h3 className="text-lg font-semibold">{message}</h3>
            <p className="text-sm text-muted-foreground">Please wait... </p>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
};