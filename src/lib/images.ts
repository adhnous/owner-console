export function transformCloudinary(url: string, opts?: { w?: number; q?: string | number; fAuto?: boolean }) {
  try {
    const u = new URL(url);
    if (u.hostname !== 'res.cloudinary.com') return url;
    const parts = u.pathname.split('/');
    // Expecting: /<cloud_name>/image/upload/.../public_id
    const uploadIndex = parts.findIndex((p) => p === 'upload');
    if (uploadIndex === -1) return url;

    // If a transformation segment already exists (has commas or known params), keep it.
    const nextSeg = parts[uploadIndex + 1] || '';
    const hasTransforms = /[_,]/.test(nextSeg) && /(w_|q_|f_auto|c_|g_|ar_)/.test(nextSeg);
    if (hasTransforms) return url;

    const w = opts?.w ?? 800;
    const q = opts?.q ?? 'auto';
    const fAuto = opts?.fAuto !== false; // default true
    const transforms = [fAuto ? 'f_auto' : '', `q_${q}`, `w_${w}`].filter(Boolean).join(',');
    parts.splice(uploadIndex + 1, 0, transforms);
    u.pathname = parts.join('/');
    return u.toString();
  } catch {
    return url;
  }
}
