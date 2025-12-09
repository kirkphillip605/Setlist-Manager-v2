import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw } from 'lucide-react';
import { motion, useAnimation } from 'framer-motion';

export const PullToRefresh = ({ children }: { children: React.ReactNode }) => {
    const queryClient = useQueryClient();
    const [startY, setStartY] = useState(0);
    const [pulling, setPulling] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [pullHeight, setPullHeight] = useState(0);
    const controls = useAnimation();
    
    // Threshold to trigger refresh
    const THRESHOLD = 100;

    const handleTouchStart = (e: React.TouchEvent) => {
        if (window.scrollY === 0) {
            setStartY(e.touches[0].clientY);
            setPulling(true);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!pulling) return;
        const currentY = e.touches[0].clientY;
        const diff = currentY - startY;

        // Only pull if scrolling down from top
        if (diff > 0 && window.scrollY === 0) {
            // Resistance effect
            const height = Math.min(diff * 0.4, 150);
            setPullHeight(height);
        } else {
            setPullHeight(0);
        }
    };

    const handleTouchEnd = async () => {
        if (!pulling) return;
        setPulling(false);

        if (pullHeight > THRESHOLD * 0.6) { // 60px roughly
            setRefreshing(true);
            setPullHeight(60); // Snap to loading state
            
            // Trigger React Query Invalidation
            await queryClient.invalidateQueries();
            
            // Simulate minimum UI delay
            setTimeout(() => {
                setRefreshing(false);
                setPullHeight(0);
            }, 800);
        } else {
            setPullHeight(0);
        }
    };

    return (
        <div 
            onTouchStart={handleTouchStart} 
            onTouchMove={handleTouchMove} 
            onTouchEnd={handleTouchEnd}
            className="min-h-screen"
        >
            <motion.div 
                className="fixed top-0 left-0 right-0 flex justify-center items-center z-50 pointer-events-none"
                animate={{ height: pullHeight }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                style={{ overflow: 'hidden' }}
            >
                <div className="flex items-center gap-2 text-sm font-medium text-primary bg-background/90 backdrop-blur rounded-full px-4 py-1 shadow-lg mt-2">
                    {refreshing ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Refreshing...
                        </>
                    ) : (
                        <>
                            <RefreshCw className="h-4 w-4" style={{ transform: `rotate(${pullHeight * 2}deg)` }} />
                            Pull to refresh
                        </>
                    )}
                </div>
            </motion.div>
            
            {children}
        </div>
    );
};