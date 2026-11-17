"""把去好背的角色圖（透明底 PNG）做成遊戲用的兩張圖：全身與頭像。

用法：python3 scripts/make-photo-art.py <去背圖.png> <角色 id> <頭中心x> <頭中心y> <頭半邊長>
後三個數字是「裁掉透明邊之後、全身高當作 1」的比例（頭中心 x 也是除以全身高）。
去背可以用 rembg（模型 isnet-general-use）。輸出到 src/assets/photo/<id>-body.webp、<id>-head.webp，
再到 src/scenes/components/photoArt.ts 的 PHOTO_ART 加一筆。
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

BODY_H = 640
HEAD = 256

src, key, hx, hy, hs = sys.argv[1], sys.argv[2], *map(float, sys.argv[3:6])
im = Image.open(src).convert("RGBA")
# 邊緣往內縮一點，去掉背景留下的亮邊
r, g, b, a = im.split()
a = a.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(1.2))
im = Image.merge("RGBA", (r, g, b, a))
alpha = np.array(a)
ys, xs = np.where(alpha > 24)
im = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
h = im.height
out = Path(__file__).resolve().parent.parent / "src" / "assets" / "photo"
out.mkdir(parents=True, exist_ok=True)

body = im.resize((round(im.width * BODY_H / h), BODY_H), Image.LANCZOS)
body.save(out / f"{key}-body.webp", quality=88, method=6)
box = [round(v * h) for v in (hx - hs, hy - hs, hx + hs, hy + hs)]
head = im.crop(box).resize((HEAD, HEAD), Image.LANCZOS)
head.save(out / f"{key}-head.webp", quality=90, method=6)
print("body", body.size, "aspect", round(im.width / h, 4), "head box", box)
