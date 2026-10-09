/**
 * Screen Wake Lock API service
 * Keeps the mobile / desktop screen active during active media streaming,
 * peer file transfers, and host serving to prevent mobile OS throttling.
 */

class WakeLockManager {
  private sentinel: any = null;
  private activeReasons = new Set<string>();
  private isSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.activeReasons.size > 0) {
          this.reacquire();
        }
      });
    }
  }

  public async acquire(reason: string): Promise<boolean> {
    this.activeReasons.add(reason);
    if (!this.isSupported) return false;

    if (this.sentinel) return true;

    try {
      this.sentinel = await (navigator as any).wakeLock.request('screen');
      this.sentinel.addEventListener('release', () => {
        this.sentinel = null;
      });
      return true;
    } catch (err) {
      console.warn(`[WakeLock] Could not acquire screen wake lock for "${reason}":`, err);
      return false;
    }
  }

  public release(reason: string): void {
    this.activeReasons.delete(reason);
    if (this.activeReasons.size === 0 && this.sentinel) {
      try {
        this.sentinel.release();
      } catch {}
      this.sentinel = null;
    }
  }

  public isLocked(): boolean {
    return this.sentinel !== null;
  }

  private async reacquire(): Promise<void> {
    if (!this.isSupported || this.sentinel) return;
    try {
      this.sentinel = await (navigator as any).wakeLock.request('screen');
      this.sentinel.addEventListener('release', () => {
        this.sentinel = null;
      });
    } catch (err) {
      console.warn('[WakeLock] Could not reacquire lock on visibility change:', err);
    }
  }
}

export const wakeLock = new WakeLockManager();
