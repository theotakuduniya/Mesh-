/**
 * Screen Wake Lock API Service
 * Keeps mobile and desktop screens awake during active P2P media streaming,
 * peer file transfers, and host serving to prevent OS tab throttling and connection dropouts.
 */

export type WakeLockListener = (isLocked: boolean, reasons: string[]) => void;

class WakeLockManager {
  private sentinel: any = null;
  private activeReasons = new Set<string>();
  private listeners = new Set<WakeLockListener>();
  private isSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.activeReasons.size > 0) {
          this.reacquire();
        }
      });

      if (typeof window !== 'undefined') {
        window.addEventListener('focus', () => {
          if (this.activeReasons.size > 0 && !this.sentinel) {
            this.reacquire();
          }
        });
      }
    }
  }

  /**
   * Acquire Screen Wake Lock with a tracked reason (e.g. 'stream', 'transfer', 'stream_host')
   */
  public async acquire(reason: string): Promise<boolean> {
    this.activeReasons.add(reason);
    this.notify();

    if (!this.isSupported) {
      return false;
    }

    if (this.sentinel) {
      return true;
    }

    try {
      this.sentinel = await (navigator as any).wakeLock.request('screen');
      this.sentinel.addEventListener('release', () => {
        this.sentinel = null;
        this.notify();
      });
      this.notify();
      return true;
    } catch (err) {
      console.warn(`[WakeLock] Could not acquire screen wake lock for "${reason}":`, err);
      return false;
    }
  }

  /**
   * Release Screen Wake Lock for a specific reason.
   * Sentinel is released once all active reasons have cleared.
   */
  public release(reason: string): void {
    this.activeReasons.delete(reason);
    if (this.activeReasons.size === 0 && this.sentinel) {
      try {
        this.sentinel.release();
      } catch {}
      this.sentinel = null;
    }
    this.notify();
  }

  /**
   * Returns whether wake lock is currently requested / active
   */
  public isLocked(): boolean {
    return this.sentinel !== null || this.activeReasons.size > 0;
  }

  /**
   * Returns true if browser supports the Screen Wake Lock API
   */
  public hasSupport(): boolean {
    return this.isSupported;
  }

  /**
   * Returns list of currently active reasons keeping screen awake
   */
  public getActiveReasons(): string[] {
    return Array.from(this.activeReasons);
  }

  /**
   * Subscribe to wake lock state changes
   */
  public subscribe(listener: WakeLockListener): () => void {
    this.listeners.add(listener);
    listener(this.isLocked(), this.getActiveReasons());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const locked = this.isLocked();
    const reasons = this.getActiveReasons();
    this.listeners.forEach((cb) => {
      try {
        cb(locked, reasons);
      } catch {}
    });
  }

  private async reacquire(): Promise<void> {
    if (!this.isSupported || this.sentinel) return;
    try {
      this.sentinel = await (navigator as any).wakeLock.request('screen');
      this.sentinel.addEventListener('release', () => {
        this.sentinel = null;
        this.notify();
      });
      this.notify();
    } catch (err) {
      console.warn('[WakeLock] Could not reacquire lock on visibility change:', err);
    }
  }
}

export const wakeLock = new WakeLockManager();
