'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { transformCloudinary } from '@/lib/images';
import { Play } from 'lucide-react';

export type MediaGalleryProps = {
  title: string;
  images: Array<{ url: string; hint?: string }>;
  videoEmbedUrl?: string | null;
  videoEmbedUrls?: string[] | null;
};

type MediaItem =
  | { type: 'image'; url: string; hint?: string }
  | { type: 'video'; url: string };

export default function MediaGallery({ title, images, videoEmbedUrl, videoEmbedUrls }: MediaGalleryProps) {
  const media: MediaItem[] = useMemo(() => {
    const pics: MediaItem[] = (images && images.length > 0 ? images : [{ url: 'https://placehold.co/800x600.png' }]).map(
      (img) => ({
        type: 'image',
        url: img.url,
        hint: (img as any).hint as string | undefined,
      })
    );
    const items: MediaItem[] = [...pics];
    const vids: string[] = [];
    if (videoEmbedUrl) vids.push(videoEmbedUrl);
    if (Array.isArray(videoEmbedUrls)) vids.push(...videoEmbedUrls.filter(Boolean));
    for (const v of vids) items.push({ type: 'video', url: v });
    return items;
  }, [images, videoEmbedUrl, videoEmbedUrls]);

  const [active, setActive] = useState(0);

  function getYoutubeThumb(embedUrl: string | null): string | null {
    if (!embedUrl) return null;
    try {
      const u = new URL(embedUrl);
      const id = u.pathname.split('/').pop() || '';
      if (!id) return null;
      return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    } catch {
      return null;
    }
  }

  const isVideo = media[active]?.type === 'video';

  return (
    <div className="grid gap-3 md:grid-cols-[84px_1fr]">
      {/* Thumbnails */}
      <div className="order-2 flex gap-2 overflow-x-auto md:order-1 md:flex-col md:overflow-y-auto">
        {media.map((m, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setActive(idx)}
            className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded border bg-background transition ${
              active === idx ? 'ring-2 ring-primary' : 'hover:border-primary/40'
            }`}
            aria-label={m.type === 'image' ? `Thumbnail ${idx + 1}` : 'Video thumbnail'}
          >
            {m.type === 'image' ? (
              <Image
                src={transformCloudinary(m.url, { w: 160, q: 'auto' })}
                alt={title}
                width={64}
                height={64}
                className="h-full w-full object-cover"
              />
            ) : getYoutubeThumb(m.url) ? (
              // Use normal img tag to avoid Next.js remotePatterns issues
              <img src={getYoutubeThumb(m.url) as string} alt={title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-black/80 text-white">Video</div>
            )}
            {m.type === 'video' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Play className="h-6 w-6 text-white" />
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Main viewer */}
      <div className="order-1 overflow-hidden rounded-lg border md:order-2">
        {isVideo ? (
          <div className="aspect-video w-full">
            <iframe
              src={String(media[active].url)}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              title={`${title} - video`}
            />
          </div>
        ) : (
          <Image
            src={transformCloudinary(String(media[active].url), { w: 1200, q: 'auto' })}
            alt={title}
            width={1200}
            height={900}
            className="aspect-square w-full object-cover md:aspect-video"
          />
        )}
      </div>
    </div>
  );
}
