'use client';

import { useEffect, useRef, useState } from 'react';
import { uploadUserPhoto, isCloudinaryConfigured } from '@/lib/cloudinary';
import { MAX_PHOTOS } from '@/lib/onboarding/options';

type PhotoStatus = 'local' | 'uploading' | 'uploaded' | 'failed';
interface ProfilePhotoItem {
  id: string;
  localPreviewUrl: string;
  uploadedUrl?: string;
  status: PhotoStatus;
}

export function ProfilePhotoManager({
  uid,
  photos,
  onChange,
  onPendingChange,
  onFailedChange,
  error,
}: {
  uid: string;
  photos: string[];
  onChange: (urls: string[]) => void;
  onPendingChange: (pending: boolean) => void;
  onFailedChange: (failed: boolean) => void;
  error?: string;
}) {
  const [items, setItems] = useState<ProfilePhotoItem[]>(() =>
    photos.map((url, index) => ({ id: `restored-${index}-${url}`, localPreviewUrl: url, uploadedUrl: url, status: 'uploaded' })),
  );
  const itemsRef = useRef(items);
  const inputRef = useRef<HTMLInputElement>(null);
  const configured = isCloudinaryConfigured();

  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => () => {
    itemsRef.current.forEach((item) => {
      if (item.localPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(item.localPreviewUrl);
    });
  }, []);

  function commit(next: ProfilePhotoItem[]) {
    itemsRef.current = next;
    setItems(next);
    onChange(next.flatMap((item) => item.uploadedUrl ? [item.uploadedUrl] : []));
    onPendingChange(next.some((item) => item.status === 'uploading'));
    onFailedChange(next.some((item) => item.status === 'failed'));
  }

  async function add(file: File) {
    if (itemsRef.current.length >= MAX_PHOTOS) return;
    const id = crypto.randomUUID();
    const preview = URL.createObjectURL(file);
    const item: ProfilePhotoItem = { id, localPreviewUrl: preview, status: 'uploading' };
    const initial = [...itemsRef.current, item];
    commit(initial);
    const uploadIndex = initial.findIndex((candidate) => candidate.id === id);
    try {
      const uploadedUrl = await uploadUserPhoto(file, uid, uploadIndex);
      const current = itemsRef.current;
      const currentIndex = current.findIndex((candidate) => candidate.id === id);
      if (currentIndex < 0) { URL.revokeObjectURL(preview); return; }
      const next = current.map((candidate) =>
        candidate.id === id ? { ...candidate, uploadedUrl, status: 'uploaded' as const } : candidate,
      );
      commit(next);
    } catch {
      const current = itemsRef.current;
      if (current.some((candidate) => candidate.id === id)) {
        commit(current.map((candidate) => candidate.id === id ? { ...candidate, status: 'failed' as const } : candidate));
      }
    }
  }

  function remove(id: string) {
    const current = itemsRef.current;
    const removed = current.find((item) => item.id === id);
    if (removed?.localPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(removed.localPreviewUrl);
    commit(current.filter((item) => item.id !== id));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= itemsRef.current.length) return;
    const next = [...itemsRef.current];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  }

  return (
    <div>
      {!configured && <p className="mb-4 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-xs text-[#725426]">Photo upload is not configured in this local environment.</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void add(file);
          event.target.value = '';
        }}
      />
      <div className="grid grid-cols-3 gap-3">
        {items.map((item, index) => (
          <div key={item.id} className={`relative aspect-[4/5] overflow-hidden rounded-2xl border ${index === 0 ? 'border-gold ring-1 ring-gold' : 'border-line-strong'}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.localPreviewUrl} alt={index === 0 ? 'Primary profile photo' : `Profile photo ${index + 1}`} className="h-full w-full object-cover" />
            <span className="absolute left-2 top-2 rounded-full bg-maroon/90 px-2 py-1 text-[10px] font-semibold text-cream">{index === 0 ? 'Primary' : `Photo ${index + 1}`}</span>
            <button type="button" onClick={() => remove(item.id)} aria-label={`Remove photo ${index + 1}`} className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-charcoal/70 text-cream">×</button>
            <div className="absolute inset-x-2 bottom-2 flex justify-between">
              <button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Move photo left" className="h-8 w-8 rounded-full bg-charcoal/70 text-cream disabled:opacity-30">←</button>
              <button type="button" disabled={index === items.length - 1} onClick={() => move(index, 1)} aria-label="Move photo right" className="h-8 w-8 rounded-full bg-charcoal/70 text-cream disabled:opacity-30">→</button>
            </div>
            {item.status === 'uploading' && <div className="absolute inset-0 flex items-center justify-center bg-charcoal/45"><span className="h-6 w-6 animate-spin rounded-full border-2 border-cream/40 border-t-cream" /></div>}
            {item.status === 'failed' && <div className="absolute inset-x-0 bottom-10 bg-red-800/85 px-2 py-1 text-center text-[10px] text-white">Upload failed — remove and retry</div>}
          </div>
        ))}
        {items.length < MAX_PHOTOS && (
          <button type="button" data-photo-add onClick={() => inputRef.current?.click()} className="flex aspect-[4/5] min-h-28 flex-col items-center justify-center rounded-2xl border border-dashed border-gold/60 bg-cream text-maroon hover:bg-gold/5">
            <span className="text-2xl" aria-hidden>＋</span><span className="mt-1 text-xs font-semibold">Add photo</span>
          </button>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">Photo one is primary. Add up to three clear, recent photos.</p>
      {error && <p id="photos-error" className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
