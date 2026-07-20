'use client';

import React from 'react';
import { PROPOSAL_THEMES, ProposalThemeId } from '@/lib/proposalThemes';
import { Check, Palette } from 'lucide-react';

interface ProposalThemePickerProps {
  value: ProposalThemeId;
  onChange: (theme: ProposalThemeId) => void;
}

export default function ProposalThemePicker({ value, onChange }: ProposalThemePickerProps) {
  const themes = Object.values(PROPOSAL_THEMES);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Palette className="w-3.5 h-3.5 text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Client Presentation Theme
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {themes.map((theme) => {
          const selected = value === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => onChange(theme.id)}
              className={`relative min-w-0 text-left rounded-lg border p-2 transition-all ${
                selected
                  ? 'border-primary ring-2 ring-primary/30 bg-primary/5'
                  : 'border-border bg-card hover:border-primary/40'
              }`}
            >
              <div className={`mb-1.5 h-7 rounded-md ${theme.swatch}`} />
              <p className="truncate text-[10px] font-bold text-foreground">{theme.name}</p>
              <p className="mt-0.5 line-clamp-2 text-[9px] leading-snug text-muted-foreground">
                {theme.description}
              </p>
              {selected && (
                <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-2.5 w-2.5" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
