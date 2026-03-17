import * as React from "react";
import { X, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

const SUGGESTED_DESTINATIONS = [
  "Cairo",
  "Luxor",
  "Aswan",
  "Alexandria",
  "Hurghada",
  "Sharm El Sheikh",
  "Dahab",
  "Marsa Alam",
  "El Gouna",
  "Siwa Oasis",
  "Fayoum",
  "Abu Simbel",
  "Saint Catherine",
  "Nuweiba",
  "Taba",
  "Soma Bay",
  "Safaga",
];

interface DestinationTagInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function DestinationTagInput({
  value,
  onChange,
  placeholder = "Type a destination and press Enter",
  disabled = false,
  className,
}: DestinationTagInputProps) {
  const [inputValue, setInputValue] = React.useState("");
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const filtered = React.useMemo(() => {
    if (!inputValue.trim()) return SUGGESTED_DESTINATIONS.filter((d) => !value.includes(d));
    const q = inputValue.toLowerCase();
    return SUGGESTED_DESTINATIONS.filter(
      (d) => d.toLowerCase().includes(q) && !value.includes(d)
    );
  }, [inputValue, value]);

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInputValue("");
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((v) => v !== tag));
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && filtered[highlightedIndex]) {
        addTag(filtered[highlightedIndex]);
      } else if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      removeTag(value[value.length - 1]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    }
  };

  // Close suggestions on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Scroll highlighted item into view
  const suggestionsRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (highlightedIndex >= 0 && suggestionsRef.current) {
      const item = suggestionsRef.current.children[highlightedIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 min-h-[44px] cursor-text transition-colors",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onClick={() => !disabled && inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-accent/15 text-accent-foreground border border-accent/30 px-2.5 py-0.5 text-xs font-medium animate-fade-in"
          >
            <MapPin className="w-3 h-3 text-accent shrink-0" />
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive transition-colors"
              aria-label={`Remove ${tag}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowSuggestions(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : "Add more..."}
          disabled={disabled}
          className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && filtered.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 mt-1 w-full max-h-[200px] overflow-y-auto rounded-md border border-border bg-popover shadow-lg animate-fade-in"
        >
          {filtered.map((dest, i) => (
            <button
              key={dest}
              type="button"
              className={cn(
                "flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition-colors",
                i === highlightedIndex
                  ? "bg-accent/15 text-foreground"
                  : "text-popover-foreground hover:bg-muted"
              )}
              onMouseEnter={() => setHighlightedIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent blur
                addTag(dest);
                setShowSuggestions(true);
              }}
            >
              <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              {dest}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
