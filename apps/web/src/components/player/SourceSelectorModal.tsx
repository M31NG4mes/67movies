'use client';

import React from 'react';
import { X, PlayCircle, Radio, Check } from 'lucide-react';
import { StreamSourceGroup, VideoStream } from '@cinemaflow/types';

interface SourceSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceGroups: StreamSourceGroup[];
  activeStream: VideoStream | null;
  onSelectStream: (stream: VideoStream) => void;
}

export function SourceSelectorModal({
  isOpen,
  onClose,
  sourceGroups,
  activeStream,
  onSelectStream,
}: SourceSelectorModalProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-cinema-surface border border-cinema-border rounded-2xl shadow-2xl p-6 text-white max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-cinema-border">
          <div className="flex items-center space-x-2">
            <Radio className="w-5 h-5 text-brand-main" />
            <h2 className="text-xl font-bold tracking-wide">Источники и озвучки</h2>
          </div>
          <button
            onClick={onClose}
            data-nav-item="true"
            className="p-2 text-cinema-muted hover:text-white hover:bg-cinema-card rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Groups */}
        <div className="py-4 space-y-5 overflow-y-auto">
          {sourceGroups.length === 0 ? (
            <div className="text-center py-8 text-cinema-muted">
              Поиск доступных источников...
            </div>
          ) : (
            sourceGroups.map((group, gIdx) => (
              <div key={gIdx} className="bg-cinema-card border border-cinema-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-[11px] uppercase font-bold text-brand-light tracking-wider">
                      {group.providerName}
                    </span>
                    {group.voiceActing && (
                      <h3 className="text-sm font-semibold text-white mt-0.5">
                        {group.voiceActing}
                      </h3>
                    )}
                  </div>
                  <span className="text-xs text-cinema-muted bg-cinema-surface px-2.5 py-1 rounded-full border border-cinema-border">
                    {group.streams.length} потоков
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {group.streams.map((stream) => {
                    const isSelected = activeStream?.id === stream.id;
                    return (
                      <button
                        key={stream.id}
                        data-nav-item="true"
                        onClick={() => {
                          onSelectStream(stream);
                          onClose();
                        }}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                          isSelected
                            ? 'bg-brand-main text-white font-semibold shadow-brand-glow'
                            : 'bg-cinema-surface hover:bg-cinema-cardHover text-cinema-muted hover:text-white border border-cinema-border/50'
                        }`}
                      >
                        <span className="flex items-center space-x-2">
                          <PlayCircle className="w-4 h-4" />
                          <span>{stream.quality}</span>
                        </span>
                        {isSelected && <Check className="w-4 h-4" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
