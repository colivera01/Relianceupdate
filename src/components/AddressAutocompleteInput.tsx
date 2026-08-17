"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { AddressAutocompleteSuggestion } from "@/lib/address-autocomplete";

type AddressAutocompleteInputProps = Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  onSelectAddress: (suggestion: AddressAutocompleteSuggestion) => void;
  inputClassName?: string;
  suggestionClassName?: string;
};

export function AddressAutocompleteInput({
  value,
  onChange,
  onSelectAddress,
  inputClassName,
  suggestionClassName,
  disabled,
  ...props
}: AddressAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<AddressAutocompleteSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const safeValue = String(value || "");
  const query = useMemo(() => safeValue.trim(), [safeValue]);

  useEffect(() => {
    if (disabled || query.length < 3) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/address/autocomplete?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => ({}))) as {
          suggestions?: AddressAutocompleteSuggestion[];
        };
        const nextSuggestions = Array.isArray(payload.suggestions) ? payload.suggestions : [];
        setSuggestions(nextSuggestions);
        setOpen(nextSuggestions.length > 0);
        setHighlightedIndex(-1);
      } catch (error) {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setOpen(false);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [disabled, query]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const selectSuggestion = (suggestion: AddressAutocompleteSuggestion) => {
    onSelectAddress(suggestion);
    setOpen(false);
    setSuggestions([]);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((current) => (current < suggestions.length - 1 ? current + 1 : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((current) => (current > 0 ? current - 1 : suggestions.length - 1));
    } else if (event.key === "Enter" && highlightedIndex >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[highlightedIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
      setHighlightedIndex(-1);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        {...props}
        value={safeValue}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        disabled={disabled}
        autoComplete="street-address"
        className={inputClassName}
      />
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
        {loading ? (
          <span className="block h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
        ) : (
          <Search className="h-4 w-4" />
        )}
      </div>
      {open ? (
        <div
          className={`absolute z-[130] mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-700 bg-[#081120] shadow-[0_24px_70px_rgba(2,8,23,0.78)] ring-1 ring-black/30 ${suggestionClassName || ""}`}
          role="listbox"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              type="button"
              role="option"
              aria-selected={index === highlightedIndex}
              className={`flex w-full items-start gap-3 border-b border-white/6 px-3 py-3 text-left text-sm transition-colors last:border-b-0 ${
                index === highlightedIndex ? "bg-blue-600 text-white" : "text-slate-100 hover:bg-slate-800"
              }`}
              onMouseEnter={() => setHighlightedIndex(index)}
              onClick={() => selectSuggestion(suggestion)}
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-200" />
              <span>
                <span className="block font-medium">{suggestion.address}</span>
                <span className="block text-xs text-slate-300">
                  {suggestion.city}, {suggestion.state} {suggestion.zipCode}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
