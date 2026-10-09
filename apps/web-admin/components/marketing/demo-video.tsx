'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import { marketingConfig } from '../../lib/marketing-config';
import { track } from '../../lib/track';
import { strings } from '../../lib/strings';

/**
 * Lazy YouTube embed: only a static poster renders until the visitor taps
 * play, so no YouTube scripts load on page open. Without a video id it shows
 * a "coming soon" placeholder.
 */
export function DemoVideo() {
  const id = marketingConfig.demoVideoYoutubeId;
  const [playing, setPlaying] = useState(false);

  if (playing && id) {
    return (
      <div className="aspect-video overflow-hidden rounded-3xl bg-black shadow-xl">
        <iframe
          className="h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={strings.marketing.videoTitle}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={!id}
      onClick={() => {
        track('video_play');
        setPlaying(true);
      }}
      className="group relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-teal to-[#1B4B4A] shadow-xl disabled:cursor-default"
      aria-label={id ? strings.marketing.videoPlay : strings.marketing.videoComingSoon}
    >
      {id && (
        // Poster from YouTube's static image host (no script).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover opacity-70"
        />
      )}
      <span className="relative flex flex-col items-center gap-3 text-white">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-teal shadow-lg transition-transform group-hover:scale-105">
          <Play className="ml-1 h-7 w-7" aria-hidden />
        </span>
        <span className="text-sm font-semibold">{id ? strings.marketing.videoPlay : strings.marketing.videoComingSoon}</span>
      </span>
    </button>
  );
}
