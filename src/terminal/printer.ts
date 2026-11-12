import type { Line } from './line';

type Sink = (lines: Line[]) => void;
type BusyListener = (busy: boolean) => void;

/**
 * Feeds lines to the screen one at a time, the way a terminal on a slow serial
 * link would. Each line may carry its own `delay`; `flush` skips the wait.
 */
export class LinePrinter {
  private readonly queue: Line[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly sink: Sink;
  private readonly onBusyChange: BusyListener;
  private readonly interval: number;

  constructor(sink: Sink, onBusyChange: BusyListener, interval = 12) {
    this.sink = sink;
    this.onBusyChange = onBusyChange;
    this.interval = interval;
  }

  get busy(): boolean {
    return this.timer !== null;
  }

  print(lines: readonly Line[]): void {
    if (lines.length === 0) return;
    this.queue.push(...lines);
    if (!this.busy) {
      this.onBusyChange(true);
      this.schedule();
    }
  }

  /** Prints everything still queued immediately. */
  flush(): void {
    if (!this.busy) return;
    this.stop();
    this.sink(this.queue.splice(0));
    this.onBusyChange(false);
  }

  /** Drops queued lines without printing them. */
  dispose(): void {
    this.stop();
    this.queue.length = 0;
  }

  private stop(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    const delay = this.queue[0]?.delay ?? this.interval;
    this.timer = setTimeout(() => this.tick(), delay);
  }

  private tick(): void {
    const next = this.queue.shift();
    if (next) this.sink([next]);

    if (this.queue.length > 0) {
      this.schedule();
    } else {
      this.timer = null;
      this.onBusyChange(false);
    }
  }
}
