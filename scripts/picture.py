"""Turns a photo into a picture for the terminal: a mask with the brightness in its alpha.

    python -I scripts/picture.py <photo> <album>/<name> [--size 160] [--square]
                                 [--black N] [--white N] [--gamma 1.5] [--warm]
                                 [--preview DIR]

Writes src/assets/gallery/<album>/<name>.png, and <name>.preview.png (amber on
black, three times the size) next to the photo or in --preview DIR, to judge the
result before adding it. The page paints the phosphor colour through the mask,
so one file serves amber and green alike. The mask is drawn from scratch, so no
EXIF data (camera, GPS) from the photo reaches the site. Needs Pillow and NumPy.

Tuning: by default the darkest 2% and brightest 0.5% of the photo set black
and white; --black and --white (0-255) fix them instead. --gamma sets the
mid-tones: the default 1.5 keeps them dim, so a bright sky does not turn into a
flat slab of light; below 1 lifts them, for a dark subject. --warm keeps warm
colours (skin) and fades cool greys, which drops a plain studio backdrop out of
a portrait. --square crops a square from the top centre, where a face usually
is; otherwise the photo keeps its proportions.
"""

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageOps

GALLERY = Path(__file__).resolve().parent.parent / "src" / "assets" / "gallery"

parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
parser.add_argument("photo", type=Path)
parser.add_argument("name", help="album folder and file name, without .png: portraits/me")
parser.add_argument("--size", type=int, default=160, help="longer side in pixels")
parser.add_argument("--square", action="store_true", help="crop a square from the top centre")
parser.add_argument("--black", type=float, help="0-255: this and darker is off")
parser.add_argument("--white", type=float, help="0-255: this and brighter is fully lit")
parser.add_argument("--gamma", type=float, default=1.5)
parser.add_argument("--warm", action="store_true", help="fade cool backgrounds")
parser.add_argument("--preview", type=Path, help="folder for the preview (default: the photo's)")
args = parser.parse_args()

# Upright as the camera meant it, then down to size.
colour = ImageOps.exif_transpose(Image.open(args.photo)).convert("RGB")
w, h = colour.size
if args.square:
    side = min(w, h)
    colour = colour.crop(((w - side) // 2, 0, (w - side) // 2 + side, side))
    size = (args.size, args.size)
else:
    scale = args.size / max(w, h)
    size = (round(w * scale), round(h * scale))
colour = colour.resize(size, Image.LANCZOS)

# Levels: lift the subject, sink everything dim.
px = np.asarray(colour.convert("L"), dtype=np.float64)
black = args.black if args.black is not None else np.percentile(px, 2)
white = args.white if args.white is not None else np.percentile(px, 99.5)
px = np.clip((px - black) / max(white - black, 1), 0, 1) ** args.gamma

if args.warm:
    # Skin is warm, a studio backdrop cool grey: red minus blue tells them apart.
    rgb = np.asarray(colour, dtype=np.float64)
    warmth = np.clip((rgb[..., 0] - rgb[..., 2] - 4) / 22, 0, 1)
    blurred = Image.fromarray((warmth * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2))
    # A faint trace of the rest keeps the outline of the head.
    px *= 0.18 + 0.82 * np.asarray(blurred, dtype=np.float64) / 255

alpha = (px * 255).astype(np.uint8)
out = GALLERY / f"{args.name}.png"
out.parent.mkdir(parents=True, exist_ok=True)
Image.fromarray(np.dstack([np.full_like(alpha, 255), alpha]), "LA").save(out, optimize=True)

preview = (np.array([255, 176, 0]) * px[..., None]).astype(np.uint8)
preview_dir = args.preview or args.photo.parent
preview_path = preview_dir / f"{out.stem}.preview.png"
Image.fromarray(preview).resize((size[0] * 3, size[1] * 3), Image.NEAREST).save(preview_path)

print(f"{out} {size[0]}x{size[1]} ({out.stat().st_size // 1024 or 1} KB)")
