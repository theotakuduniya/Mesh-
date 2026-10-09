/**
 * Storage Streaming & Persistence Engine
 * 1. FileSystemWritableFileStream (window.showSaveFilePicker) on Desktop Chromium: writes chunks directly to user disk with 0 RAM overhead.
 * 2. Origin Private File System (OPFS): acts as a virtual on-disk drive in Safari, Firefox, Chrome, and Mobile.
 * 3. Save Points: persists received chunks in OPFS so page refresh does not lose downloaded progress.
 */

export interface DiskStreamSession {
  transferId: string;
  resourceId: string;
  resourceName: string;
  fileSizeBytes: number;
  chunkSize: number;
  totalChunks: number;
  type: 'native_file_picker' | 'opfs';
  writable?: FileSystemWritableFileStream;
  opfsHandle?: FileSystemFileHandle;
  receivedChunks: number[];
}

const OPFS_DIR_NAME = 'mesh_transfers_drafts';
const METADATA_STORAGE_KEY = 'mesh_opfs_transfer_drafts_v1';

class StorageStreamEngine {
  private activeStreams = new Map<string, DiskStreamSession>();

  public isSaveFilePickerSupported(): boolean {
    return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
  }

  public isOpfsSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.storage !== 'undefined' &&
      'getDirectory' in navigator.storage
    );
  }

  /**
   * Tries to open a direct-to-disk native stream via showSaveFilePicker (Desktop Chromium)
   */
  public async createDirectDiskStream(
    transferId: string,
    resource: { id: string; name: string; sizeBytes: number; mimeType?: string },
    chunkSize: number
  ): Promise<DiskStreamSession | null> {
    if (!this.isSaveFilePickerSupported()) return null;

    try {
      const ext = resource.name.includes('.') ? '.' + resource.name.split('.').pop() : '';
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: resource.name,
        types: [
          {
            description: 'File',
            accept: {
              [resource.mimeType || 'application/octet-stream']: ext ? [ext] : [],
            },
          },
        ],
      });

      const writable = await handle.createWritable();
      const totalChunks = Math.max(1, Math.ceil(resource.sizeBytes / chunkSize));

      const session: DiskStreamSession = {
        transferId,
        resourceId: resource.id,
        resourceName: resource.name,
        fileSizeBytes: resource.sizeBytes,
        chunkSize,
        totalChunks,
        type: 'native_file_picker',
        writable,
        receivedChunks: [],
      };

      this.activeStreams.set(transferId, session);
      return session;
    } catch (err: any) {
      // User cancelled picker or permission error: fall back to OPFS
      if (err?.name !== 'AbortError') {
        console.warn('[StorageStream] Native picker error, falling back to OPFS:', err);
      }
      return null;
    }
  }

  /**
   * Initializes or resumes a stream in OPFS (Origin Private File System)
   */
  public async createOpfsStream(
    transferId: string,
    resource: { id: string; name: string; sizeBytes: number; mimeType?: string },
    chunkSize: number
  ): Promise<DiskStreamSession | null> {
    if (!this.isOpfsSupported()) return null;

    try {
      const root = await navigator.storage.getDirectory();
      let draftsDir: FileSystemDirectoryHandle;
      try {
        draftsDir = await root.getDirectoryHandle(OPFS_DIR_NAME, { create: true });
      } catch {
        draftsDir = root;
      }

      const fileName = `part_${resource.id}.bin`;
      const fileHandle = await draftsDir.getFileHandle(fileName, { create: true });
      const totalChunks = Math.max(1, Math.ceil(resource.sizeBytes / chunkSize));

      // Check existing draft resume progress
      const existingDraft = this.getStoredDraftMetadata(resource.id);
      const receivedChunks = existingDraft ? existingDraft.receivedChunks : [];

      let writable: FileSystemWritableFileStream | undefined;
      if ('createWritable' in fileHandle) {
        writable = await fileHandle.createWritable({ keepExistingData: true });
      }

      const session: DiskStreamSession = {
        transferId,
        resourceId: resource.id,
        resourceName: resource.name,
        fileSizeBytes: resource.sizeBytes,
        chunkSize,
        totalChunks,
        type: 'opfs',
        opfsHandle: fileHandle,
        writable,
        receivedChunks,
      };

      this.activeStreams.set(transferId, session);
      this.persistDraftMetadata(session);
      return session;
    } catch (err) {
      console.warn('[StorageStream] OPFS initialization failed:', err);
      return null;
    }
  }

  /**
   * Writes a single chunk directly to disk without holding previous chunks in memory
   */
  public async writeChunk(
    transferId: string,
    chunkIndex: number,
    data: Blob | ArrayBuffer | Uint8Array
  ): Promise<boolean> {
    const session = this.activeStreams.get(transferId);
    if (!session) return false;

    const offset = chunkIndex * session.chunkSize;

    try {
      if (session.writable) {
        await session.writable.write({
          type: 'write',
          position: offset,
          data: data as any,
        });
      } else if (session.opfsHandle && 'createWritable' in session.opfsHandle) {
        const tempWritable = await session.opfsHandle.createWritable({ keepExistingData: true });
        await tempWritable.write({
          type: 'write',
          position: offset,
          data: data as any,
        });
        await tempWritable.close();
      }

      if (!session.receivedChunks.includes(chunkIndex)) {
        session.receivedChunks.push(chunkIndex);
      }

      // Periodically update OPFS save point (every 8 chunks or on last)
      if (session.type === 'opfs' && (session.receivedChunks.length % 8 === 0 || session.receivedChunks.length >= session.totalChunks)) {
        this.persistDraftMetadata(session);
      }

      return true;
    } catch (err) {
      console.warn(`[StorageStream] Error writing chunk ${chunkIndex} for ${transferId}:`, err);
      return false;
    }
  }

  /**
   * Finalizes and closes the disk stream when 100% completed
   */
  public async finishStream(transferId: string): Promise<Blob | null> {
    const session = this.activeStreams.get(transferId);
    if (!session) return null;

    try {
      if (session.writable) {
        await session.writable.close();
      }

      this.activeStreams.delete(transferId);
      this.clearDraftMetadata(session.resourceId);

      // If native file picker, file is already directly on user hard drive!
      if (session.type === 'native_file_picker') {
        return null;
      }

      // If OPFS, return the File Blob from OPFS for saving or playback
      if (session.opfsHandle) {
        const file = await session.opfsHandle.getFile();
        return file;
      }
    } catch (err) {
      console.warn(`[StorageStream] Error closing stream ${transferId}:`, err);
    }
    return null;
  }

  /**
   * Checks if an incomplete transfer draft exists in OPFS from a previous session (e.g. before page refresh)
   */
  public getResumeInfo(resourceId: string): { receivedChunks: number[]; totalChunks: number; bytesReceived: number } | null {
    const draft = this.getStoredDraftMetadata(resourceId);
    if (!draft || draft.receivedChunks.length === 0) return null;

    return {
      receivedChunks: draft.receivedChunks,
      totalChunks: draft.totalChunks,
      bytesReceived: draft.receivedChunks.length * draft.chunkSize,
    };
  }

  public cancelStream(transferId: string): void {
    const session = this.activeStreams.get(transferId);
    if (session) {
      if (session.writable) {
        try { session.writable.abort(); } catch {}
      }
      this.activeStreams.delete(transferId);
    }
  }

  private persistDraftMetadata(session: DiskStreamSession): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const stored = this.getAllStoredDrafts();
      stored[session.resourceId] = {
        resourceId: session.resourceId,
        resourceName: session.resourceName,
        fileSizeBytes: session.fileSizeBytes,
        chunkSize: session.chunkSize,
        totalChunks: session.totalChunks,
        receivedChunks: session.receivedChunks,
        lastUpdated: Date.now(),
      };
      localStorage.setItem(METADATA_STORAGE_KEY, JSON.stringify(stored));
    } catch {}
  }

  private getStoredDraftMetadata(resourceId: string): any | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const stored = this.getAllStoredDrafts();
      return stored[resourceId] || null;
    } catch {
      return null;
    }
  }

  private clearDraftMetadata(resourceId: string): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const stored = this.getAllStoredDrafts();
      delete stored[resourceId];
      localStorage.setItem(METADATA_STORAGE_KEY, JSON.stringify(stored));
    } catch {}
  }

  private getAllStoredDrafts(): Record<string, any> {
    try {
      const raw = localStorage.getItem(METADATA_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }
}

export const storageStream = new StorageStreamEngine();
