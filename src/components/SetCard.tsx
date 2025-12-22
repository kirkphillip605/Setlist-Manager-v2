import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, 
    DropdownMenuSeparator, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
    Plus, Trash2, ArrowUp, ArrowDown, MoreVertical, ArrowRightLeft, Clock, Star, ChevronDown, ChevronRight
} from "lucide-react";
import { Set as SetType, Setlist } from "@/types";
import { formatDurationRounded } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface SetCardProps {
    set: SetType;
    setlist: Setlist;
    setDuration: number;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    onAddSong: (setId: string) => void;
    onDeleteSet: (setId: string) => void;
    onRemoveSong: (songId: string) => void;
    onMoveOrder: (setId: string, songIndex: number, direction: 'up' | 'down') => void;
    onMoveToSet: (setSongId: string, targetSetId: string) => void;
}

export const SetCard = ({
    set,
    setlist,
    setDuration,
    isCollapsed,
    onToggleCollapse,
    onAddSong,
    onDeleteSet,
    onRemoveSong,
    onMoveOrder,
    onMoveToSet
}: SetCardProps) => {
    const isEncore = set.name === "Encore";

    return (
        <Card className={cn(
            "overflow-hidden border-2 transition-all",
            isEncore ? "border-amber-400 bg-amber-50/30 dark:bg-amber-950/10" : ""
        )}>
            <CardHeader 
                className={cn(
                    "py-3 flex flex-row items-center justify-between gap-2 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors",
                    isEncore ? "bg-amber-100/50 dark:bg-amber-900/20" : "bg-muted/40"
                )}
                onClick={onToggleCollapse}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 -ml-1 text-muted-foreground">
                        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                    <Badge variant={isEncore ? "default" : "outline"} className={cn("text-base px-3 py-1 whitespace-nowrap shrink-0", isEncore ? "bg-amber-500 hover:bg-amber-600" : "bg-background")}>
                        {isEncore && <Star className="w-3 h-3 mr-1 fill-current" />}
                        {set.name}
                    </Badge>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground truncate">
                        <Clock className="w-3 h-3 shrink-0" />
                        <span className="truncate">{formatDurationRounded(setDuration)}</span>
                    </div>
                </div>
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" onClick={() => onAddSong(set.id)} className="h-9 px-2 sm:px-3">
                        <Plus className="sm:mr-1 h-4 w-4" /> 
                        <span className="hidden sm:inline">Add Song</span>
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-9 w-9 text-muted-foreground hover:text-destructive" 
                        onClick={() => onDeleteSet(set.id)}
                    >
                        <Trash2 className="h-5 w-5" />
                    </Button>
                </div>
            </CardHeader>
            {!isCollapsed && (
                <CardContent className="p-0 animate-in slide-in-from-top-2 fade-in">
                    {set.songs.length === 0 ? (
                        <div className="p-8 text-center text-sm text-muted-foreground">
                            No songs in this set.
                        </div>
                    ) : (
                        <div className="divide-y">
                            {set.songs.map((setSong, index) => (
                                <div key={setSong.id} className="flex items-center p-3 hover:bg-accent/30 group">
                                    <div className="flex items-center justify-center gap-3 text-muted-foreground mr-3 w-8 shrink-0">
                                        <span className="text-sm font-mono font-medium">{index + 1}</span>
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                            <div className={`font-medium truncate max-w-full ${setSong.song?.is_retired ? 'line-through text-muted-foreground' : ''}`}>
                                                {setSong.song?.title}
                                            </div>
                                            {setSong.song?.is_retired && (
                                                <Badge variant="outline" className="text-[10px] h-4 px-1 py-0">Retired</Badge>
                                            )}
                                        </div>
                                        <div className="text-xs text-muted-foreground truncate">{setSong.song?.artist}</div>
                                    </div>

                                    <div className="flex items-center gap-2 sm:gap-4 text-sm mr-2 shrink-0">
                                        {setSong.song?.key && (
                                            <Badge variant="secondary" className="font-mono font-normal text-xs px-1.5 h-5 hidden xs:inline-flex">
                                                {setSong.song.key}
                                            </Badge>
                                        )}
                                        <span className="text-xs text-muted-foreground w-12 text-right hidden sm:block">
                                            {setSong.song?.duration || "3:00"}
                                        </span>
                                    </div>

                                    {/* Actions - Context Menu Only */}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
                                                <MoreVertical className="h-5 w-5" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-56 p-2">
                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                            <DropdownMenuItem onClick={() => onRemoveSong(setSong.id)} className="text-destructive focus:text-destructive py-3">
                                                <Trash2 className="mr-2 h-4 w-4" /> Remove from Set
                                            </DropdownMenuItem>
                                            
                                            <DropdownMenuSeparator />
                                            <DropdownMenuLabel>Change Order</DropdownMenuLabel>
                                            <DropdownMenuItem 
                                                disabled={index === 0}
                                                onClick={() => onMoveOrder(set.id, index, 'up')}
                                                className="py-3"
                                            >
                                                <ArrowUp className="mr-2 h-4 w-4" /> Move Up
                                            </DropdownMenuItem>
                                            <DropdownMenuItem 
                                                disabled={index === set.songs.length - 1}
                                                onClick={() => onMoveOrder(set.id, index, 'down')}
                                                className="py-3"
                                            >
                                                <ArrowDown className="mr-2 h-4 w-4" /> Move Down
                                            </DropdownMenuItem>

                                            <DropdownMenuSeparator />
                                            <DropdownMenuLabel>Move to Set...</DropdownMenuLabel>
                                            {setlist.sets.map(targetSet => (
                                                <DropdownMenuItem 
                                                    key={targetSet.id}
                                                    disabled={targetSet.id === set.id}
                                                    onClick={() => onMoveToSet(setSong.id, targetSet.id)}
                                                    className="py-3"
                                                >
                                                    <ArrowRightLeft className="mr-2 h-4 w-4" /> {targetSet.name}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            )}
        </Card>
    );
};