'use client';

import React from 'react';
import { X, Mic, Check, Sparkles } from 'lucide-react';
import { StreamSourceGroup, VideoQuality, VideoStream } from '@cinemaflow/types';

interface SourceSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceGroups: StreamSourceGroup[];
  activeStream: VideoStream | null;
  onSelectStream: (stream: VideoStream) => void;
}

/**
 * Voiceover-only selector modal (keeps current quality when switching studio).
 */
export function SourceSelectorModal({
  isOpen,
  onClose,
  sourceGroups,
  activeStream,
  onSelectStream,
}: SourceSelectorModalProps) {
  if (!isOpen) return null;

  const currentQuality = activeStream?.quality || '1080p';

  const handleSelectGroup = (group: StreamSourceGroup) => {
    const matched =
      group.streams.find((s) => s.quality === currentQuality) ||
      group.streams.find((s) => s.quality === '1080p') ||
      group.streams.find((s) => s.quality === '720p') ||
      group.streams[0];
    if (matched) {
      onSelectStream(matched);
      onClose();
    }
  };

  return (
    <div
      onClick={onClose}
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fadeIn p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-cinema-surface border border-cinema-border rounded-2xl shadow-2xl p-5 text-white max-h-[80vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-cinema-border">
          <div className="flex items-center space-x-2">
            <Mic className="w-5 h-5 text-brand-main" />
            <h2 className="text-lg font-bold tracking-wide">Выбор озвучки</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-cinema-muted hover:text-white hover:bg-cinema-card rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Voiceover Studios List */}
        <div className="py-3 space-y-2 overflow-y-auto">
          {sourceGroups.length === 0 ? (
            <div className="text-center py-8 text-cinema-muted text-sm">
              Озвучки не найдены
            </div>
          ) : (
            sourceGroups.map((group, gIdx) => {
              const isSelected =
                activeStream?.providerId === group.providerId ||
                group.streams.some((s) => s.id === activeStream?.id);
              return (
                <button
                  key={`${group.providerId}-${gIdx}`}
                  type="button"
                  onClick={() => handleSelectGroup(group)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-brand-main/20 border-brand-main text-white shadow-brand-glow'
                      : 'bg-cinema-card hover:bg-cinema-cardHover border-cinema-border text-cinema-muted hover:text-white'
                  }`}
                >
                  <div>
                    <div className="text-sm font-bold text-white">
                      {group.providerName}
                    </div>
                    {group.voiceActing && group.voiceActing !== group.providerName && (
                      <div className="text-xs text-cinema-muted mt-0.5">
                        {group.voiceActing}
                      </div>
                    )}
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-brand-light flex-shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

interface QualitySelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceGroups: StreamSourceGroup[];
  activeStream: VideoStream | null;
  activeQuality: VideoQuality;
  onSelectStreamQuality: (stream: VideoStream, quality: VideoQuality, height: number) => void;
}

/**
 * Quality-only selector modal (switches resolution while keeping current voiceover).
 */
export function QualitySelectorModal({
  isOpen,
  onClose,
  sourceGroups,
  activeStream,
  activeQuality,
  onSelectStreamQuality,
}: QualitySelectorModalProps) {
  if (!isOpen) return null;

  const currentGroup =
    sourceGroups.find((g) => g.providerId === activeStream?.providerId) ||
    sourceGroups.find((g) => g.streams.some((s) => s.id === activeStream?.id)) ||
    sourceGroups[0];

  const streams = currentGroup?.streams || (activeStream ? [activeStream] : []);

  const qualityHeight = (q: VideoQuality): number => {
    if (q === '2160p') return 2160;
    if (q === '1440p') return 1440;
    if (q === '1080p') return 1080;
    if (q === '720p') return 720;
    return 0;
  };

  return (
    <div
      onClick={onClose}
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fadeIn p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm bg-cinema-surface border border-cinema-border rounded-2xl shadow-2xl p-5 text-white flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-cinema-border">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-brand-main" />
            <h2 className="text-lg font-bold tracking-wide">Качество видео</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-cinema-muted hover:text-white hover:bg-cinema-card rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quality Options */}
        <div className="py-3 space-y-2">
          {streams.map((stream) => {
            const isSelected =
              activeStream?.id === stream.id || activeQuality === stream.quality;
            return (
              <button
                key={stream.id}
                type="button"
                onClick={() => {
                  onSelectStreamQuality(
                    stream,
                    stream.quality,
                    qualityHeight(stream.quality)
                  );
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-bold transition-all ${
                  isSelected
                    ? 'bg-brand-main/20 border-brand-main text-white shadow-brand-glow'
                    : 'bg-cinema-card hover:bg-cinema-cardHover border-cinema-border text-cinema-muted hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{stream.quality}</span>
                  {stream.quality === '1080p' && (
                    <span className="px-1.5 py-0.5 text-[10px] rounded bg-brand-main/30 text-brand-light uppercase">
                      Full HD
                    </span>
                  )}
                  {stream.quality === '720p' && (
                    <span className="px-1.5 py-0.5 text-[10px] rounded bg-white/10 text-white/80 uppercase">
                      HD
                    </span>
                  )}
                </div>
                {isSelected && <Check className="w-4 h-4 text-brand-light" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
