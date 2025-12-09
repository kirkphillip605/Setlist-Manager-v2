import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, 
    DropdownMenuSeparator, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
    Plus, Trash2, ArrowUp, ArrowDown, MoreVertical, ArrowRightLeft, Clock 
} from "lucide-react";
import { Set as SetType, Setlist } from "@/types";
import { formatSecondsToDuration } from "@/lib/utils";

interface SetCardProps {
    set: SetType;
    setlist: Setlist;
    setDuration: number;
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
    onAddSong,
    onDeleteSet,
    onRemoveSong,
    onMoveOrder,
    onMoveToSet
}: SetCardProps) => {
    return (
        <Card className="overflow-hidden border-2">
            <CardHeader className="bg-muted/40 py-3 flex flex-row items-center justify-between">
                <div className="flex items-center gap-4">
                    <Badge variant="outline" className="bg-background text-base px-3 py-1">{set.name}</Badge>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{formatSecondsToDuration(setDuration)}</span>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => onAddSong(set.id)} className="h-10 px-3">
                        <Plus className="mr-1 h-4 w-4" /> Add Song
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-10 w-10 text-muted-foreground hover:text-destructive" 
                        onClick={() => onDeleteSet(set.id)}
                    >
                        <Trash2 className="h-5 w-5" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {set.songs.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                        No songs in this set.
                    </div>
                ) : (
                    <div className="divide-y">
                        {set.songs.map((setSong, index) => (
                            <div key={setSong.id} className="flex items-center p-3 hover:bg-accent/30 group">
                                <div className="flex items-center gap-3 text-muted-foreground mr-3 w-6 justify-center">
                                    <span className="text-sm font-mono">{index + 1}</span>
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <div className={`font-medium truncate ${setSong.song?.is_retired ? 'line-through text-muted-foreground' : ''}`}>
                                            {setSong.song?.title}
                                        </div>
                                        {setSong.song?.is_retired && (
                                            <Badge variant="outline" className="text-[10px] h-4 px-1 py-0">Retired</Badge>
                                        )}
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate">{setSong.song?.artist}</div>
                                </div>

                                <div className="flex items-center gap-4 text-sm mr-4 shrink-0">
                                    {setSong.song?.key && (
                                        <Badge variant="secondary" className="font-mono font-normal text-xs px-1.5 h-5">
                                            {setSong.song.key}
                                        </Badge>
                                    )}
                                    <span className="text-xs text-muted-foreground w-12 text-right">
                                        {setSong.song?.duration || "3:00"}
                                    </span>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                    <div className="flex flex-col mr-1">
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-8 w-8" 
                                            disabled={index === 0}
                                            onClick={() => onMoveOrder(set.id, index, 'up')}
                                        >
                                            <ArrowUp className="h-4 w-4" />
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-8 w-8"
                                            disabled={index === set.songs.length - 1}
                                            onClick={() => onMoveOrder(set.id, index, 'down')}
                                        >
                                            <ArrowDown className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-10 w-10">
                                                <MoreVertical className="h-5 w-5" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="p-2">
                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                            <DropdownMenuItem onClick={() => onRemoveSong(setSong.id)} className="text-destructive focus:text-destructive py-3">
                                                <Trash2 className="mr-2 h-4 w-4" /> Remove from Set
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
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};