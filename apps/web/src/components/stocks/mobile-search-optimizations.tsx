import { useState, useEffect, useRef } from "react";
import { Search, X, Keyboard, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSearch?: (query: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  showSuggestions?: boolean;
  suggestions?: string[];
  onSuggestionSelect?: (suggestion: string) => void;
}

export function MobileSearchInput({
  value,
  onChange,
  onSearch,
  onFocus,
  onBlur,
  placeholder = "搜索股票代码或名称...",
  className,
  autoFocus = false,
  disabled = false,
  showSuggestions = false,
  suggestions = [],
  onSuggestionSelect,
}: MobileSearchInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(false);
  const [inputMode, setInputMode] = useState<"search" | "text" | "numeric">("search");
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle mobile virtual keyboard optimization
  useEffect(() => {
    const handleResize = () => {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        const viewportHeight = window.visualViewport?.height || window.innerHeight;
        const isKeyboardVisible = viewportHeight < window.innerHeight * 0.8;
        setShowVirtualKeyboard(isKeyboardVisible);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Optimize input mode based on content
  useEffect(() => {
    if (value.length === 0) {
      setInputMode("search");
    } else if (/^\d+$/.test(value)) {
      setInputMode("numeric"); // For stock codes
    } else {
      setInputMode("text");
    }
  }, [value]);

  const handleInputChange = (newValue: string) => {
    onChange(newValue);
  };

  const handleFocus = () => {
    setIsFocused(true);
    onFocus?.();
    
    // Auto-switch to appropriate keyboard
    if (/^\d+$/.test(value)) {
      setInputMode("numeric");
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    onBlur?.();
  };

  const handleClear = () => {
    onChange("");
    inputRef.current?.focus();
  };

  const handleSearch = () => {
    if (value.trim()) {
      onSearch?.(value.trim());
    }
  };

  const handleSuggestionSelect = (suggestion: string) => {
    onChange(suggestion);
    onSuggestionSelect?.(suggestion);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
    if (e.key === "Escape") {
      handleClear();
    }
  };

  return (
    <div className={cn(
      "relative",
      "min-h-[56px]", // Larger touch target for mobile
      className
    )}>
      {/* Main search input */}
      <div className={cn(
        "relative flex items-center",
        "bg-background border border-border rounded-lg",
        "transition-all duration-200",
        isFocused && "ring-2 ring-ring border-ring",
        showVirtualKeyboard && "rounded-b-none"
      )}>
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
          <Search className="h-5 w-5 text-muted-foreground" />
        </div>
        
        <input
          ref={inputRef}
          type="text"
          inputMode={inputMode}
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={disabled}
          className={cn(
            "w-full pl-12 pr-20 py-4",
            "bg-transparent border-none outline-none",
            "text-base placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-0",
            // Prevent iOS zoom
            "text-size-adjust-none",
            // Touch optimization
            "touch-manipulation",
            // Virtual keyboard optimization
            showVirtualKeyboard && "text-lg"
          )}
          enterKeyHint="search"
          autoCapitalize="none"
          autoComplete="off"
          spellCheck="false"
        />

        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className={cn(
                "p-2 rounded-md",
                "text-muted-foreground hover:text-foreground",
                "transition-colors duration-150",
                "min-h-[40px] min-w-[40px]", // Touch target
                "active:scale-95" // Touch feedback
              )}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">清除</span>
            </button>
          )}
          
          <button
            type="button"
            onClick={handleSearch}
            disabled={!value.trim()}
            className={cn(
              "px-4 py-2 rounded-md",
              "bg-primary text-primary-foreground",
              "disabled:bg-muted disabled:text-muted-foreground",
              "transition-all duration-150",
              "min-h-[40px]", // Touch target
              "active:scale-95", // Touch feedback
              "font-medium text-sm"
            )}
          >
            搜索
          </button>
        </div>
      </div>

      {/* Mobile-specific suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && isFocused && (
        <div className={cn(
          "absolute top-full left-0 right-0 z-50",
          "bg-background border border-t-0 border-border rounded-b-lg",
          "shadow-lg",
          "max-h-64 overflow-y-auto",
          "touch-pan-y" // Enable touch scrolling
        )}>
          <div className="p-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionSelect(suggestion)}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-md",
                  "hover:bg-muted transition-colors duration-150",
                  "min-h-[48px]", // Touch target
                  "flex items-center gap-3",
                  "active:bg-muted/70" // Touch feedback
                )}
              >
                <Search className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{suggestion}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mobile keyboard toolbar */}
      {showVirtualKeyboard && (
        <div className={cn(
          "absolute top-full left-0 right-0 z-40",
          "bg-muted border border-t-0 border-border rounded-b-lg",
          "p-2",
          "flex items-center justify-between"
        )}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setInputMode(inputMode === "numeric" ? "text" : "numeric")}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs",
                "bg-background border border-border",
                "hover:bg-muted transition-colors"
              )}
            >
              <Keyboard className="h-3 w-3 mr-1 inline" />
              {inputMode === "numeric" ? "ABC" : "123"}
            </button>
          </div>
          
          <div className="text-xs text-muted-foreground">
            点击完成或搜索
          </div>
          
          <button
            type="button"
            onClick={handleSearch}
            disabled={!value.trim()}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs",
              "bg-primary text-primary-foreground",
              "disabled:bg-muted disabled:text-muted-foreground"
            )}
          >
            完成
          </button>
        </div>
      )}
    </div>
  );
}

interface MobileSearchSuggestionsProps {
  suggestions: Array<{
    id: string;
    text: string;
    type: "stock" | "history" | "trending";
    subtitle?: string;
  }>;
  onSelect: (suggestion: string) => void;
  isVisible: boolean;
  className?: string;
}

export function MobileSearchSuggestions({
  suggestions,
  onSelect,
  isVisible,
  className,
}: MobileSearchSuggestionsProps) {
  if (!isVisible || suggestions.length === 0) {
    return null;
  }

  return (
    <div className={cn(
      "absolute top-full left-0 right-0 z-50 mt-1",
      "bg-background border border-border rounded-lg shadow-lg",
      "max-h-96 overflow-y-auto",
      "touch-pan-y", // Enable touch scrolling
      className
    )}>
      <div className="p-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.id}
            onClick={() => onSelect(suggestion.text)}
            className={cn(
              "w-full text-left p-4 rounded-lg",
              "hover:bg-muted/50 transition-colors duration-200",
              "active:bg-muted/70", // Touch feedback
              "min-h-[60px]", // Larger touch target
              "flex items-start gap-3",
              "border-b border-border last:border-b-0"
            )}
          >
            <div className="flex-shrink-0 mt-1">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center",
                suggestion.type === "stock" && "bg-blue-100 text-blue-600",
                suggestion.type === "history" && "bg-gray-100 text-gray-600",
                suggestion.type === "trending" && "bg-orange-100 text-orange-600"
              )}>
                <Search className="h-4 w-4" />
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="text-base font-medium text-foreground mb-1">
                {suggestion.text}
              </div>
              {suggestion.subtitle && (
                <div className="text-sm text-muted-foreground">
                  {suggestion.subtitle}
                </div>
              )}
            </div>
            
            <div className="flex-shrink-0">
              <ChevronDown className="h-4 w-4 text-muted-foreground rotate-270" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

