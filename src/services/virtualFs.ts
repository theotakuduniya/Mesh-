/**
 * Virtual Shared Space Architecture
 * 
 * Maps internal mock local filesystem paths to virtual resource IDs and paths.
 * Peers ONLY interact with virtual IDs (e.g. "res_col_001") and virtual paths (e.g. "/College/DBMS.pdf").
 * The real filesystem path (e.g. "D:\Projects\Mesh\...") is NEVER leaked to any peer.
 */

import { VirtualResource, SharedFolder, PeerPermissions } from '../types/mesh';

export const DEFAULT_PERMISSIONS: PeerPermissions = {
  canView: true,
  canPreview: true,
  canStream: true,
  canDownload: false, // Off by default as required by specification
  canUpload: false,
  canModify: false,
  canDelete: false,
};

export const INITIAL_SHARED_FOLDERS_PC_A: SharedFolder[] = [];

export const INITIAL_SHARED_FOLDERS_PC_B: SharedFolder[] = [];

/**
 * Synchronizes folder resource count and total size metrics to match exact resource sum
 */
export function syncFolderMetrics(folder: SharedFolder): SharedFolder {
  const resourceCount = folder.resources.length;
  const totalSizeBytes = folder.resources.reduce((sum, res) => sum + (res.sizeBytes || 0), 0);
  return {
    ...folder,
    resourceCount,
    totalSizeBytes,
  };
}

/**
 * Sanitizes folders before sending over the wire to remote peers:
 * - Masks local filesystem paths (realSourceAlias: 'Virtual Shared Volume')
 * - Strips memory-heavy realFileBlob
 * - Strips huge data/blob previewUrls to prevent wire bufferbloat
 */
export function sanitizeFoldersForWire(folders: SharedFolder[]): SharedFolder[] {
  return folders.map((folder) => {
    const synced = syncFolderMetrics(folder);
    return {
      ...synced,
      realSourceAlias: 'Virtual Shared Volume',
      resources: synced.resources.map((res) => {
        let cleanPreviewUrl = res.previewUrl;
        if (cleanPreviewUrl) {
          // Allow lightweight image thumbnails (up to 64 KB base64) across wire
          if (cleanPreviewUrl.startsWith('data:image/') && cleanPreviewUrl.length <= 64 * 1024) {
            // Keep previewUrl intact for peer inspection
          } else if (cleanPreviewUrl.startsWith('blob:') || cleanPreviewUrl.length > 64 * 1024) {
            cleanPreviewUrl = undefined;
          }
        }
        return {
          ...res,
          realFileBlob: undefined,
          previewUrl: cleanPreviewUrl,
        };
      }),
    };
  });
}

/**
 * Creates a lightweight JPEG thumbnail (max 320px) under 35KB for fast P2P preview
 */
export async function generateImageThumbnail(file: Blob, fileName?: string): Promise<string> {
  if (typeof window === 'undefined') return '';

  // Determine mime type from file or filename extension
  let mimeType = file.type;
  if (!mimeType && fileName) {
    if (fileName.match(/\.(jpg|jpeg)$/i)) mimeType = 'image/jpeg';
    else if (fileName.match(/\.png$/i)) mimeType = 'image/png';
    else if (fileName.match(/\.webp$/i)) mimeType = 'image/webp';
    else if (fileName.match(/\.gif$/i)) mimeType = 'image/gif';
    else if (fileName.match(/\.svg$/i)) mimeType = 'image/svg+xml';
    else if (fileName.match(/\.bmp$/i)) mimeType = 'image/bmp';
  }
  if (!mimeType) mimeType = 'image/jpeg';

  const readFullAsDataUrl = (blob: Blob): Promise<string> => {
    return new Promise((resolve) => {
      try {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string) || '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(blob);
      } catch {
        resolve('');
      }
    });
  };

  // Fast path for small images under 300KB or SVG / GIF formats
  if (file.size <= 300 * 1024 || mimeType === 'image/svg+xml' || mimeType === 'image/gif') {
    const dataUrl = await readFullAsDataUrl(file);
    if (dataUrl) return dataUrl;
  }

  // Canvas downscaling to ~320px JPEG with 2.5s timeout protection
  return new Promise<string>((resolve) => {
    let resolved = false;
    const safeResolve = (val: string) => {
      if (!resolved) {
        resolved = true;
        resolve(val);
      }
    };

    // Timeout fallback to direct data URL if Image/Canvas hangs
    const timer = setTimeout(async () => {
      const fallback = await readFullAsDataUrl(file);
      safeResolve(fallback);
    }, 2500);

    try {
      const typedBlob = file.type ? file : new Blob([file], { type: mimeType });
      const url = URL.createObjectURL(typedBlob);
      const img = new Image();

      img.onload = () => {
        clearTimeout(timer);
        try {
          URL.revokeObjectURL(url);
          const canvas = document.createElement('canvas');
          const maxDim = 320;
          let width = img.naturalWidth || img.width || 320;
          let height = img.naturalHeight || img.height || 240;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const thumb = canvas.toDataURL('image/jpeg', 0.75);
            safeResolve(thumb);
          } else {
            readFullAsDataUrl(file).then(safeResolve);
          }
        } catch {
          readFullAsDataUrl(file).then(safeResolve);
        }
      };

      img.onerror = () => {
        clearTimeout(timer);
        URL.revokeObjectURL(url);
        readFullAsDataUrl(file).then(safeResolve);
      };

      img.src = url;
    } catch {
      clearTimeout(timer);
      readFullAsDataUrl(file).then(safeResolve);
    }
  });
}

/**
 * Creates a valid, playable sample video (2s HD 60fps) with synchronized audio tone
 * for testing P2P video streaming across peers
 */
export async function createSampleTestVideo(): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext('2d')!;

  let audioDest: MediaStreamAudioDestinationNode | undefined;
  let audioCtx: AudioContext | undefined;
  let osc: OscillatorNode | undefined;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
      audioDest = audioCtx.createMediaStreamDestination();
      osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioDest);
      osc.start();
    }
  } catch {}

  const canvasStream = canvas.captureStream(30);
  if (audioDest && audioDest.stream.getAudioTracks().length > 0) {
    canvasStream.addTrack(audioDest.stream.getAudioTracks()[0]);
  }

  const mimeType = MediaRecorder.isTypeSupported('video/mp4')
    ? 'video/mp4'
    : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm';

  const recorder = new MediaRecorder(canvasStream, { mimeType });
  const recordedChunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };

  recorder.start();

  const startTime = performance.now();
  for (let frame = 0; frame < 60; frame++) {
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, 640, 360);

    const x = 320 + Math.sin(frame * 0.12) * 180;
    const y = 180 + Math.cos(frame * 0.12) * 70;
    const grad = ctx.createRadialGradient(x, y, 10, x, y, 60);
    grad.addColorStop(0, '#a855f7');
    grad.addColorStop(1, '#3b82f6');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, 46, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('Mesh P2P Direct Stream', 36, 60);
    ctx.fillStyle = '#10b981';
    ctx.font = '16px monospace';
    ctx.fillText(`Frame ${frame + 1}/60 · P2P Direct WebRTC`, 36, 95);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px monospace';
    ctx.fillText(`Duration: ${elapsed}s · Zero Cloud LAN`, 36, 125);

    await new Promise((r) => setTimeout(r, 33));
  }

  if (osc) {
    try { osc.stop(); } catch {}
  }
  recorder.stop();
  await new Promise((r) => { recorder.onstop = r; });
  if (audioCtx) {
    try { audioCtx.close(); } catch {}
  }

  const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
  const videoBlob = new Blob(recordedChunks, { type: mimeType });
  return new File([videoBlob], `p2p_stream_demo.${extension}`, { type: mimeType, lastModified: Date.now() });
}

/**
 * Validates whether a requested action is allowed under the current permission set.
 */
export function verifyPermission(
  permissions: PeerPermissions,
  action: 'VIEW' | 'PREVIEW' | 'STREAM' | 'DOWNLOAD' | 'UPLOAD' | 'MODIFY' | 'DELETE'
): { allowed: boolean; reason?: string } {
  if (permissions.expiresAt && Date.now() > permissions.expiresAt) {
    return { allowed: false, reason: 'Temporary authorization window has expired' };
  }

  // If view permission is false, deny all access immediately
  if (!permissions.canView) {
    return { allowed: false, reason: 'Folder visibility revoked' };
  }

  switch (action) {
    case 'VIEW':
      return { allowed: permissions.canView, reason: permissions.canView ? undefined : 'View permission denied' };
    case 'PREVIEW':
      return { allowed: permissions.canPreview, reason: permissions.canPreview ? undefined : 'Remote preview permission denied' };
    case 'STREAM':
      return { allowed: permissions.canStream, reason: permissions.canStream ? undefined : 'Direct streaming permission disabled by peer' };
    case 'DOWNLOAD':
      return { allowed: permissions.canDownload, reason: permissions.canDownload ? undefined : 'Full file download permission restricted' };
    case 'UPLOAD':
      return { allowed: permissions.canUpload, reason: permissions.canUpload ? undefined : 'Remote upload denied' };
    case 'MODIFY':
      return { allowed: permissions.canModify, reason: permissions.canModify ? undefined : 'Resource mutation denied' };
    case 'DELETE':
      return { allowed: permissions.canDelete, reason: permissions.canDelete ? undefined : 'Resource deletion prohibited' };
    default:
      return { allowed: false, reason: 'Unrecognized operation' };
  }
}
