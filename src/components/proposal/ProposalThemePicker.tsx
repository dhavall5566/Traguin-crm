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
      <div className="grid grid-cols-2 gap-2">
        {themes.map((theme) => {
          const selected = value === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => onChange(theme.id)}
              className={`relative text-left p-2.5 rounded-xl border transition-all ${
                selected
                  ? 'border-primary ring-2 ring-primary/30 bg-primary/5'
                  : 'border-border hover:border-primary/40 bg-card'
              }`}
            >
              <div className={`h-8 rounded-lg mb-2 ${theme.swatch}`} />
              <p className="text-[10px] font-bold text-foreground">{theme.name}</p>
              <p className="text-[9px] text-muted-foreground leading-snug">{theme.description}</p>
              {selected && (
                <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  <Check className="w-2.5 h-2.5" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
