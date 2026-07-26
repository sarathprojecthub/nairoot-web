'use client';

import { useEffect, useRef, useState } from 'react';
import { uploadUserPhoto, isCloudinaryConfigured } from '@/lib/cloudinary';
import { MAX_PHOTOS } from '@/lib/onboarding/options';

type PhotoStatus = 'uploading' | 'uploaded' | 'failed';
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
    photos.slice(0, MAX_PHOTOS).map((url, index) => ({ id: `restored-${index}-${url}`, localPreviewUrl: url, uploadedUrl: url, status: 'uploaded' })),
  );
  const itemsRef = useRef(items);
  const inputRef = useRef<HTMLInputElement>(null);
  const targetSlotRef = useRef(0);
  const uploadTokenRef = useRef<Record<string, number>>({});
  const nextTokenRef = useRef(0);
  const configured = isCloudinaryConfigured();

  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => () => {
    itemsRef.current.forEach((item) => {
      if (item.localPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(item.localPreviewUrl);
    });
  }, []);

  function commit(nextItems: ProfilePhotoItem[]) {
    const compacted = nextItems.slice(0, MAX_PHOTOS);
    itemsRef.current = compacted;
    setItems(compacted);
    onChange(compacted.flatMap((item) => item.uploadedUrl ? [item.uploadedUrl] : []));
    onPendingChange(compacted.some((item) => item.status === 'uploading'));
    onFailedChange(compacted.some((item) => item.status === 'failed'));
  }

  function chooseSlot(index: number) {
    if (!configured) return;
    targetSlotRef.current = Math.min(index, itemsRef.current.length);
    inputRef.current?.click();
  }

  async function addOrReplace(file: File, slotIndex: number) {
    const current = itemsRef.current;
    if (slotIndex > current.length || (slotIndex >= MAX_PHOTOS && !current[slotIndex])) return;

    const id = crypto.randomUUID();
    const preview = URL.createObjectURL(file);
    const token = ++nextTokenRef.current;
    uploadTokenRef.current[id] = token;
    const previous = current[slotIndex];
    const item: ProfilePhotoItem = {
      id,
      localPreviewUrl: preview,
      uploadedUrl: previous?.uploadedUrl,
      status: 'uploading',
    };
    const initial = [...current];
    initial[slotIndex] = item;
    commit(initial.filter(Boolean));

    if (previous?.localPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(previous.localPreviewUrl);

    try {
      const uploadIndex = itemsRef.current.findIndex((candidate) => candidate.id === id);
      if (uploadIndex < 0) return;
      const uploadedUrl = await uploadUserPhoto(file, uid, uploadIndex);
      if (uploadTokenRef.current[id] !== token) return;
      const next = itemsRef.current.map((candidate) =>
        candidate.id === id ? { ...candidate, uploadedUrl, status: 'uploaded' as const } : candidate,
      );
      commit(next);
    } catch {
      if (uploadTokenRef.current[id] !== token) return;
      const next = itemsRef.current.map((candidate) =>
        candidate.id === id ? { ...candidate, status: 'failed' as const } : candidate,
      );
      commit(next);
    } finally {
      if (uploadTokenRef.current[id] === token) delete uploadTokenRef.current[id];
    }
  }

  function remove(id: string) {
    const current = itemsRef.current;
    const removed = current.find((item) => item.id === id);
    const uploadedCount = current.filter((item) => item.uploadedUrl).length;
    if (removed?.uploadedUrl && uploadedCount <= 1) return;
    if (removed?.localPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(removed.localPreviewUrl);
    delete uploadTokenRef.current[id];
    commit(current.filter((item) => item.id !== id));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= itemsRef.current.length) return;
    const next = [...itemsRef.current];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  }

  function slotHeader(index: number) {
    if (index === 0) {
      return (
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          <span className="rounded-full bg-maroon/90 px-2 py-1 text-[10px] font-semibold text-cream">Photo 1</span>
          <span className="rounded-full bg-maroon/90 px-2 py-1 text-[10px] font-semibold text-cream">Primary · Required</span>
        </div>
      );
    }

    return <span className="absolute left-2 top-2 rounded-full bg-maroon/90 px-2 py-1 text-[10px] font-semibold text-cream">{`Photo ${index + 1}`}</span>;
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
          if (file) void addOrReplace(file, targetSlotRef.current);
          event.target.value = '';
        }}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: MAX_PHOTOS }, (_, index) => {
          const item = items[index];
          if (!item) {
            return (
              <button key={index} type="button" data-photo-add onClick={() => chooseSlot(index)} disabled={!configured || index > items.length} className="flex aspect-[4/5] min-h-28 flex-col items-center justify-center rounded-2xl border border-dashed border-gold/60 bg-cream text-maroon hover:bg-gold/5 disabled:cursor-not-allowed disabled:opacity-45">
                <span className="text-2xl" aria-hidden>+</span>
                <span className="mt-1 text-xs font-semibold">{index === 0 ? 'Add primary photo' : `Add photo ${index + 1}`}</span>
              </button>
            );
          }
          const canRemove = !item.uploadedUrl || items.filter((candidate) => candidate.uploadedUrl).length > 1;
          return (
            <div key={item.id} className={`relative aspect-[4/5] overflow-hidden rounded-2xl border ${index === 0 ? 'border-gold ring-1 ring-gold' : 'border-line-strong'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.localPreviewUrl} alt={index === 0 ? 'Primary profile photo' : `Profile photo ${index + 1}`} className="h-full w-full object-cover" />
              {slotHeader(index)}
              <button type="button" onClick={() => remove(item.id)} disabled={!canRemove} aria-label={canRemove ? `Remove photo ${index + 1}` : 'Add a replacement before removing your only photo'} className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-charcoal/70 text-cream disabled:opacity-35">x</button>
              <button type="button" onClick={() => chooseSlot(index)} disabled={!configured || item.status === 'uploading'} className="absolute inset-x-2 bottom-12 min-h-8 rounded-full bg-charcoal/70 px-2 text-[11px] font-semibold text-cream disabled:opacity-50">Replace</button>
              <div className="absolute inset-x-2 bottom-2 flex justify-between">
                <button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Move photo left" className="h-8 w-8 rounded-full bg-charcoal/70 text-cream disabled:opacity-30">&lt;</button>
                <button type="button" disabled={index === items.length - 1} onClick={() => move(index, 1)} aria-label="Move photo right" className="h-8 w-8 rounded-full bg-charcoal/70 text-cream disabled:opacity-30">&gt;</button>
              </div>
              {item.status === 'uploading' && <div className="absolute inset-0 flex items-center justify-center bg-charcoal/45"><span className="h-6 w-6 animate-spin rounded-full border-2 border-cream/40 border-t-cream" /></div>}
              {item.status === 'failed' && <div className="absolute inset-x-0 bottom-24 bg-red-800/85 px-2 py-1 text-center text-[10px] text-white">Upload failed - replace or remove</div>}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted">Photo one is primary. Add up to four clear, recent photos.</p>
      {error && <p id="photos-error" className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
