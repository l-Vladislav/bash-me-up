import { useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createBarrelMap, displacementScale, supportsBarrel } from '../crt/barrel';
import { useElementSize } from '../hooks/useElementSize';
import type { UpdateSettings } from '../hooks/useSettings';
import type { Settings } from '../terminal/settings';
import { Backdrop } from './Backdrop';
import { Knob } from './Knob';
import styles from './Monitor.module.css';
import { PowerSwitch } from './PowerSwitch';

/** How far the glass bulges: 0 is flat, ~0.05 is a fishbowl. */
const CURVATURE = 0.032;

/** CSS filter amounts at the knobs' end stops; the centre position is neutral. */
const BRIGHTNESS_RANGE = { min: 0.5, max: 1.5 };
const CONTRAST_RANGE = { min: 0.6, max: 1.4 };

const scale = (position: number, range: { min: number; max: number }): number =>
  range.min + position * (range.max - range.min);

interface MonitorProps {
  /** Model name on the nameplate. */
  model: string;
  settings: Settings;
  onSettingsChange: UpdateSettings;
  powered: boolean;
  onPowerChange: (powered: boolean) => void;
  /** Extra controls on the front panel, next to the nameplate. */
  panel: ReactNode;
  children: ReactNode;
}

const classNames = (...names: (string | false | undefined)[]): string =>
  names.filter(Boolean).join(' ');

/** A monochrome video terminal: plastic case, curved glass, glowing phosphor. */
export function Monitor({
  model,
  settings,
  onSettingsChange,
  powered,
  onPowerChange,
  panel,
  children,
}: MonitorProps) {
  const filterId = useId();
  const imageRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(imageRef);
  const [canBend] = useState(supportsBarrel);

  const bend = settings.crt && canBend && size.width > 0 && size.height > 0;
  const map = useMemo(() => (bend ? createBarrelMap(size) : ''), [bend, size]);

  const picture: CSSProperties = {
    filter: `brightness(${scale(settings.brightness, BRIGHTNESS_RANGE)}) contrast(${scale(settings.contrast, CONTRAST_RANGE)})`,
  };

  return (
    <main className={classNames(styles.room, !powered && styles.off, !settings.crt && styles.flat)}>
      <Backdrop />
      <div className={styles.wallGlow} />

      <div className={styles.stage}>
        <div className={styles.case}>
          <div className={styles.vents} />
          <div className={styles.well}>
            <div className={styles.screen} style={picture} inert={!powered}>
              <div
                ref={imageRef}
                className={styles.image}
                style={bend ? { filter: `url(#${CSS.escape(filterId)})` } : undefined}
              >
                <div className={styles.beam}>
                  <div className={styles.raster} />
                  {children}
                </div>
              </div>
              <div className={styles.scanlines} />
              <div className={styles.refresh} />
              <div className={styles.flicker} />
              {!powered && <div className={styles.dot} />}
              <div className={styles.glass} />
            </div>
          </div>

          <footer className={styles.panel}>
            <span className={styles.nameplate}>{model}</span>
            {panel}
            <div className={styles.controls}>
              <Knob
                label="Bright"
                value={settings.brightness}
                onChange={(brightness) => onSettingsChange({ brightness })}
              />
              <Knob
                label="Contrast"
                value={settings.contrast}
                onChange={(contrast) => onSettingsChange({ contrast })}
              />
            </div>
            <div className={styles.power}>
              <PowerSwitch on={powered} onChange={onPowerChange} />
              <span
                className={styles.led}
                role="img"
                aria-label={powered ? 'Power on' : 'Power off'}
              />
            </div>
          </footer>
        </div>
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
