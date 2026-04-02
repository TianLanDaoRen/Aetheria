import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Check, ArrowUpDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface SortDropdownProps {
  selected: 'default' | 'title' | 'artist' | 'album';
  onChange: (selected: 'default' | 'title' | 'artist' | 'album') => void;
}

const sortOptions = [
  { value: 'default', label: 'Default' },
  { value: 'title', label: 'Title' },
  { value: 'artist', label: 'Artist' },
  { value: 'album', label: 'Album' },
] as const;

export function SortDropdown({ selected, onChange }: SortDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 💥 注入全局手势栈
  const closeDropdown = useCallback(() => setIsOpen(false), []);
  useEffect(() => {
    const stack = (window as any).aetheriaBackStack;
    if (!stack) return;

    if (isOpen) {
      stack.push(closeDropdown);
    }

    return () => {
      (window as any).aetheriaBackStack = stack.filter((fn: any) => fn !== closeDropdown);
    };
  }, [isOpen, closeDropdown]);

  const selectedLabel = sortOptions.find(o => o.value === selected)?.label || 'Sort';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border cursor-pointer",
          selected !== 'default'
            ? "bg-[#ff4e00]/20 text-[#ff4e00] border-[#ff4e00]/30"
            : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10 hover:text-white"
        )}
      >
        <ArrowUpDown className="w-3.5 h-3.5" />
        {selectedLabel}
        <ChevronDown className={cn("w-3 h-3 transition-transform", isOpen ? "rotate-180" : "")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 py-1",
              "fixed inset-4 w-auto h-auto",
              "md:absolute md:top-full md:right-0 md:left-0 md:mt-2 md:w-40 md:inset-auto"
            )}
          >
            {sortOptions.map(option => {
              const isSelected = selected === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-4 py-2 text-sm text-left hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <span className={cn("truncate pr-4", isSelected ? "text-[#ff4e00]" : "text-white/80")}>
                    {option.label}
                  </span>
                  {isSelected && <Check className="w-4 h-4 text-[#ff4e00] shrink-0" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
