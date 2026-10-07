import {
  digest,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_EDGE,
  MAX_SOURCE_BYTES,
  type PendingPhoto,
} from './model';
function matchesImage(bytes: Uint8Array, type: string) {
  if (type === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === 'image/png')
    return [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b);
  if (type === 'image/webp')
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
    );
  return false;
}
export async function preparePhoto(file: File): Promise<PendingPhoto> {
  if (file.size === 0 || file.size > MAX_SOURCE_BYTES)
    throw new Error('请选择不超过 10 MiB 的 JPG、PNG 或 WebP 图片。');
  if (!matchesImage(new Uint8Array(await file.slice(0, 12).arrayBuffer()), file.type))
    throw new Error('仅支持真实的 JPG、PNG、WebP 图片；HEIC 请先转成 JPG。');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('图片无法读取，请换一张图片，或先转换成 JPG。');
  }
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 40_000_000)
      throw new Error('图片超过 4000 万像素，请先缩小后再上传。');
    const canvas = document.createElement('canvas');
    // 浏览器重新编码会移除原始 EXIF/GPS，保留正确方向，并避免原图和文件名进入仓库。
    for (const scale of [1, 0.75, 0.5]) {
      const ratio = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height)) * scale;
      canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
      canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('当前浏览器无法处理图片。');
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.86, 0.72, 0.58]) {
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (value) =>
              value?.type === 'image/webp'
                ? resolve(value)
                : reject(new Error('当前浏览器不支持 WebP 图片压缩。')),
            'image/webp',
            quality,
          ),
        );
        if (blob.size <= MAX_IMAGE_BYTES)
          return {
            kind: 'pending',
            id: crypto.randomUUID(),
            alt: '',
            width: canvas.width,
            height: canvas.height,
            bytes: blob.size,
            hash: await digest(blob),
            blob,
          };
      }
    }
    throw new Error('压缩后图片仍然过大，请选择尺寸更小的图片。');
  } finally {
    bitmap.close();
  }
}
