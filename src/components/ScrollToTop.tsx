import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // 1. Instant scroll on window
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    
    // 2. Fallback for documentElement/body (if they are the scroll containers)
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;

    // 3. Delayed check to handle any layout shifts after render
    const timer = setTimeout(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }, 10);

    return () => clearTimeout(timer);
  }, [pathname]);

  return null;
}