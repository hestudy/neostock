import { useState, useEffect } from "react";

export function useMobileSearchOptimizations() {
  const [isMobile, setIsMobile] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent;
      const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(userAgent);
      setIsMobile(isMobileDevice);
    };

    const handleVisualViewportResize = () => {
      if (window.visualViewport) {
        const viewportHeight = window.visualViewport.height;
        const windowHeight = window.innerHeight;
        const height = windowHeight - viewportHeight;
        setKeyboardHeight(height > 0 ? height : 0);
      }
    };

    checkMobile();
    
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportResize);
      handleVisualViewportResize();
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportResize);
      }
    };
  }, []);

  return {
    isMobile,
    keyboardHeight,
    isKeyboardVisible: keyboardHeight > 100,
    // Mobile-specific optimizations
    searchInputProps: {
      inputMode: "search" as const,
      enterKeyHint: "search" as const,
      autoCapitalize: "off" as const,
      autoComplete: "off" as const,
      spellCheck: false,
    },
    // Touch-friendly interaction
    touchProps: {
      minTouchTarget: 44, // Minimum touch target size in pixels
      activeScale: 0.95, // Scale factor for touch feedback
    },
  };
}