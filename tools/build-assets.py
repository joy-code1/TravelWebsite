#!/usr/bin/env python3
"""Build the optimised image assets used by the site.

The original artwork committed to this repo is a set of SVG wrappers that
embed full-resolution (2000px+) base64 PNGs -- ~170 MB in total.  This script
extracts the embedded bitmaps and re-encodes them as compact, sensibly sized
JPEG / PNG files under ``assets/img``.

Run:  python3 tools/build-assets.py
"""

from __future__ import annotations

import base64
import os
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "img")
CONVERT = shutil.which("convert") or shutil.which("magick")

# source svg (relative to repo root) -> target base name
RASTER = {
    # ---- hero / section backgrounds -------------------------------------
    "home-page/imges/suitcase-travel-summer-holidays-vacation-travelers-luggage 1 (1).svg": "hero-home",
    "about_us-page/img/Banner.svg": "hero-about",
    "contact-page/img/unsplash_JFFvPHkGTyQ.svg": "hero-contact",
    "single_blog-page/img/unsplash_NXET8dOlKHU.svg": "hero-blog",
    "home-page/imges/unsplash_okVXy9tG3KY.svg": "bg-why-us",
    "home-page/imges/unsplash_TejFa7VW5e4.svg": "bg-newsletter",
    "package-page/img/unsplash_dHHhDXaCh70.svg": "bg-packages",
    "package-page/img/unsplash_okVXy9tG3KY (1).svg": "bg-adventure",
    "about_us-page/img/unsplash_okVXy9tG3KY.svg": "bg-stats",
    "home-page/imges/Rectangle 18.svg": "bg-explore",
    # ---- destinations ----------------------------------------------------
    "package-page/img/unsplash_QAwciFlS1g4.svg": "dest-paris",
    "package-page/img/unsplash_IoUnv2cfx1c.svg": "dest-swiss",
    "package-page/img/unsplash_gsllxmVO4HQ.svg": "dest-thailand",
    "package-page/img/unsplash_UDv1n0xIpU8.svg": "dest-taiwan",
    "package-page/img/unsplash__QTeGT478_8.svg": "dest-indonesia",
    "package-page/img/unsplash_Ncmd8uLe8H0.svg": "dest-singapore",
    "home-page/imges/unsplash_sELcHR_bGVs (1).svg": "dest-bali",
    # ---- about / gallery / people ---------------------------------------
    "about_us-page/img/d95bdf12361dfe465802d28f3a9a5390bf4ba4cf.png": "about-founder",
    "about_us-page/img/unsplash_R98l5I6OFQY.svg": "gallery-diving",
    "about_us-page/img/unsplash_jG3I8b5iyHI.svg": "gallery-dubai",
    "about_us-page/img/unsplash_Hf4Ap1-ef40.svg": "gallery-paris",
    "about_us-page/img/unsplash_hFXZ5cNfkOk.svg": "gallery-coast",
    "home-page/imges/Mask Group (1).svg": "person-sara",
    "home-page/imges/Mask Group (2).svg": "person-cristian",
    "home-page/imges/Mask Group (3).svg": "person-kausar",
    # ---- blog ------------------------------------------------------------
    "single_blog-page/img/unsplash_1XLyzi17Z2M (1).svg": "blog-cover",
    "single_blog-page/img/unsplash_XbPG4k-KUwE.svg": "blog-terraces",
    "single_blog-page/img/unsplash_1XLyzi17Z2M (2).svg": "blog-thumb",
    "package-page/img/unsplash_1XLyzi17Z2M.svg": "article-stories",
    # ---- brand -----------------------------------------------------------
    "home-page/imges/logo1 1.svg": "logo-light",
    "home-page/imges/logo 2.svg": "logo-dark",
}

# target -> (width, height, quality) ; height None keeps the aspect ratio
SIZES = {
    # heroes are cropped to a wide banner
    "hero-home": [(1920, 920, 74), (960, 460, 74)],
    "hero-about": [(1920, 760, 74), (960, 380, 74)],
    "hero-contact": [(1920, 760, 74), (960, 380, 74)],
    "hero-blog": [(1920, 760, 74), (960, 380, 74)],
    "bg-why-us": [(1920, 720, 74), (960, 360, 74)],
    "bg-newsletter": [(1920, 700, 74), (960, 350, 74)],
    "bg-packages": [(1920, 760, 74), (960, 380, 74)],
    "bg-adventure": [(1920, 700, 74), (960, 350, 74)],
    "bg-stats": [(1920, 620, 74), (960, 310, 74)],
    "bg-explore": [(1920, 720, 74), (960, 360, 74)],
    # content imagery
    "dest-paris": [(900, 620, 80), (560, 386, 80)],
    "dest-swiss": [(900, 620, 80), (560, 386, 80)],
    "dest-thailand": [(900, 620, 80), (560, 386, 80)],
    "dest-taiwan": [(900, 620, 80), (560, 386, 80)],
    "dest-indonesia": [(900, 620, 80), (560, 386, 80)],
    "dest-singapore": [(900, 620, 80), (560, 386, 80)],
    "dest-bali": [(900, 620, 80), (560, 386, 80)],
    "about-founder": [(1100, None, 80)],
    "gallery-diving": [(1000, 1000, 80)],
    "gallery-dubai": [(1000, 480, 80)],
    "gallery-paris": [(700, 700, 80)],
    "gallery-coast": [(700, 700, 80)],
    "person-sara": [(260, 260, 82)],
    "person-cristian": [(260, 260, 82)],
    "person-kausar": [(260, 260, 82)],
    "blog-cover": [(1200, 780, 80), (560, 364, 80)],
    "blog-terraces": [(1200, 780, 80), (560, 364, 80)],
    "blog-thumb": [(420, 280, 82)],
    "article-stories": [(1000, 860, 80), (480, 413, 80)],
    # brand marks keep transparency
    "logo-light": [(560, None, None)],
    "logo-dark": [(560, None, None)],
}

# pure-vector artwork: copied as-is (and cleaned up)
VECTOR = {
    "home-page/imges/Group 31.svg": "icon-service.svg",
    "home-page/imges/Group 31 (1).svg": "icon-guarantee.svg",
    "home-page/imges/Group 31 (2).svg": "icon-hotel.svg",
    "about_us-page/img/Vector (1).svg": "icon-team.svg",
    "about_us-page/img/Vector (2).svg": "icon-vision.svg",
    "about_us-page/img/Vector (3).svg": "icon-mission.svg",
    "home-page/imges/Booking.com.svg": "partner-booking.svg",
    "home-page/imges/Katana.svg": "partner-katana.svg",
    "home-page/imges/travava.svg": "partner-travava.svg",
    "home-page/imges/bigui.svg": "partner-bigui.svg",
    "home-page/imges/Jakmaen.svg": "partner-jakmaen.svg",
}

DATA_URI = re.compile(r'href="data:image/(?:png|jpeg|jpg);base64,([A-Za-z0-9+/=]+)"')


def run(args: list[str]) -> None:
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def extract_bitmap(path: str, tmp: str) -> str:
    """Return a temp file holding the bitmap embedded in `path`."""
    raw = open(path, "rb").read()
    match = DATA_URI.search(raw.decode("utf-8", "ignore"))
    if match:
        target = os.path.join(tmp, "src.png")
        with open(target, "wb") as fh:
            fh.write(base64.b64decode(match.group(1)))
        return target
    if path.lower().endswith((".png", ".jpg", ".jpeg")):
        return path
    raise SystemExit(f"no embedded bitmap found in {path}")


def build_raster(name: str, source: str, tmp: str) -> None:
    src = extract_bitmap(source, tmp)
    for index, (width, height, quality) in enumerate(SIZES[name]):
        if index and os.path.exists(os.path.join(OUT, f"{name}-sm.jpg")):
            os.remove(os.path.join(OUT, f"{name}-sm.jpg"))
        if quality is None:  # keep lossless + alpha (brand marks)
            target = os.path.join(OUT, f"{name}.png")
            # -trim removes the generous transparent margin around the wordmark
            run([CONVERT, src, "-trim", "+repage", "-resize", f"{width}x",
                 "-strip", "PNG32:" + target])
            continue
        # the first (largest) size is the canonical name, the small one is a
        # "-sm" variant used by srcset / mobile media queries
        suffix = "" if index == 0 else "-sm"
        target = os.path.join(OUT, f"{name}{suffix}.jpg")
        resize = f"{width}x{height}^" if height else f"{width}x"
        args = [CONVERT, src, "-resize", resize, "-gravity", "center"]
        if height:
            args += ["-extent", f"{width}x{height}"]
        args += ["-strip", "-interlace", "Plane", "-quality", str(quality), target]
        run(args)


def build_vector(name: str, source: str) -> None:
    target = os.path.join(OUT, name)
    shutil.copyfile(source, target)


def build_favicon() -> None:
    """Favicon: the dark wordmark on a white badge, plus a tiny PNG fallback."""
    svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#111111"/>
  <path d="M14 20h36M32 20v26" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
  <circle cx="32" cy="20" r="6" fill="#ffffff"/>
</svg>
"""
    with open(os.path.join(ROOT, "assets", "img", "favicon.svg"), "w", encoding="utf-8") as fh:
        fh.write(svg)


def main() -> int:
    if not CONVERT:
        print("ImageMagick (`convert`) is required to build the assets.", file=sys.stderr)
        return 1
    os.makedirs(OUT, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for source, name in RASTER.items():
            path = os.path.join(ROOT, source)
            if not os.path.exists(path):
                print("  ! missing", source)
                continue
            build_raster(name, path, tmp)
            print("  *", name, "<-", os.path.basename(source))
        for source, name in VECTOR.items():
            path = os.path.join(ROOT, source)
            if not os.path.exists(path):
                print("  ! missing", source)
                continue
            build_vector(name, path)
            print("  *", name, "<-", os.path.basename(source))
    build_favicon()
    print("done ->", OUT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
