"""밀착 인화 PNG 를 256색 팔레트로 줄인다(옥트리, 디더링 없음 — 강조색이 살아남는다). 약 70% 작아진다.

사용: python3 tools/art/shrink_png.py docs/design/art/*.png
contact-sheet.mjs 가 끝에 부른다. Pillow 가 없으면 아무것도 하지 않는다.
"""
import os
import sys

try:
    from PIL import Image
except ImportError:  # Pillow 없음 — 원본 그대로 둔다
    sys.exit(0)

for path in sys.argv[1:]:
    before = os.path.getsize(path)
    im = Image.open(path).convert("RGB")
    im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(path, optimize=True)
    print(f"{path}: {before // 1024}KB -> {os.path.getsize(path) // 1024}KB")
