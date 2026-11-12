import { useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createBarrelMap, displacementScale, supportsBarrel } from '../crt/barrel';
import { useElementSize } from '../hooks/useElementSize';
import styles from './Monitor.module.css';

/** How far the glass bulges: 0 is flat, ~0.05 is a fishbowl. */
const CURVATURE = 0.032;

interface MonitorProps {
  /** Turns the tube simulation (curvature, scanlines, flicker) on or off. */
  crt: boolean;
  /** Model name embossed on the case. */
  model: string;
  /** Controls on the front panel, below the screen. */
  panel: ReactNode;
  children: ReactNode;
}

/** A monochrome video terminal: plastic case, curved glass, glowing phosphor. */
export function Monitor({ crt, model, panel, children }: MonitorProps) {
  const filterId = useId();
  const imageRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(imageRef);
  const [canBend] = useState(supportsBarrel);

  const bend = crt && canBend && size.width > 0 && size.height > 0;
  const map = useMemo(() => (bend ? createBarrelMap(size) : ''), [bend, size]);

  return (
    <main className={styles.room}>
      <div className={crt ? styles.case : `${styles.case} ${styles.flat}`}>
        <div className={styles.well}>
          <div className={styles.screen}>
            <div
              ref={imageRef}
              className={styles.image}
              style={bend ? { filter: `url(#${CSS.escape(filterId)})` } : undefined}
            >
              <div className={styles.beam}>{children}</div>
            </div>
            <div className={styles.scanlines} />
            <div className={styles.refresh} />
            <div className={styles.flicker} />
            <div className={styles.glass} />
          </div>
        </div>

        <footer className={styles.panel}>
          <span className={styles.badge}>{model}</span>
          {panel}
          <span className={styles.led} role="img" aria-label="Power on" />
        </footer>
      </div>

      {bend && (
        <svg className={styles.filters} aria-hidden="true">
          <filter
            id={filterId}
            filterUnits="userSpaceOnUse"
            x={0}
            y={0}
            width={size.width}
            height={size.height}
            colorInterpolationFilters="sRGB"
          >
            <feImage
              href={map}
              x={0}
              y={0}
              width={size.width}
              height={size.height}
              preserveAspectRatio="none"
              result="map"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              scale={displacementScale(size, CURVATURE)}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </svg>
      )}
    </main>
  );
}
