/**
 * Whether the browser draws without a GPU.
 *
 * With hardware acceleration off (a setting, a blocklisted driver, a crashed
 * GPU process) Chrome composites on the CPU, and the CRT effects that are free
 * on a graphics card - the barrel filter, the blended lamps, full-screen
 * animations - drop the page to a handful of frames per second. WebGL reports
 * the renderer it ended up with, which names the software fallback.
 */

/** Renderer names of software rasterisers: Windows WARP, Chrome, Mesa. */
const SOFTWARE_RENDERERS = /basic render driver|swiftshader|llvmpipe|softpipe|software/i;

/** Whether a WebGL renderer string names a software rasteriser. */
export const isSoftwareRenderer = (renderer: string): boolean => SOFTWARE_RENDERERS.test(renderer);

const readRenderer = (): string | null => {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl');
  if (!(gl instanceof WebGLRenderingContext)) return null;

  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = String(gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  // Hand the context back at once; browsers cap how many may be alive.
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return renderer;
};

let cached: boolean | undefined;

/**
 * Whether this browser renders in software. No WebGL at all counts too: it is
 * what a disabled or blocklisted GPU usually looks like.
 */
export const isSoftwareRendering = (): boolean => {
  if (cached === undefined) {
    try {
      const renderer = readRenderer();
      cached = renderer === null || isSoftwareRenderer(renderer);
    } catch {
      cached = false;
    }
  }
  return cached;
};
