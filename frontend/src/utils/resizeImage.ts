/**
 * Shrink a photo before upload (phone cameras give 3-12 MB pictures).
 * Returns a JPEG data URL no wider/taller than `maxSide` pixels. Falls back to the
 * original file if the browser cannot read the image.
 */
export const resizeImageToDataUrl = (file: File, maxSide = 800, quality = 0.85): Promise<string> =>
  new Promise(resolve => {
    const readOriginal = () => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.readAsDataURL(file);
    };
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { readOriginal(); return; }
        ctx.fillStyle = '#fff'; // transparent PNGs become white, not black
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h); // browsers apply the camera's rotation (EXIF) when drawing
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch {
        readOriginal();
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); readOriginal(); };
    img.src = url;
  });
