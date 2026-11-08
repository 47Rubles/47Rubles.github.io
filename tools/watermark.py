#!/usr/bin/env python3
"""
47R Watermark & Web Optimizer Tool
----------------------------------
Takes original high-resolution artworks, resizes them for fast web loading,
and bakes a fine, semi-transparent diagonal "47R" watermark pattern directly
into the image pixels. The original files remain untouched.
"""

import os
import json
from PIL import Image, ImageDraw, ImageFont, ImageEnhance

DEFAULT_INPUT_DIR = r"C:\Users\tchul\OneDrive\Рабочий стол\Склад\Fото\MyW_NA"
DEFAULT_OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "assets", "gallery"))
MAX_WEB_DIMENSION = 960  # Max width or height for web version
WATERMARK_TEXT = "47R"

def create_watermarked_image(src_path, dst_path, max_dim=MAX_WEB_DIMENSION, text=WATERMARK_TEXT):
    with Image.open(src_path) as img:
        # Convert animated GIF or handle static images
        if getattr(img, "is_animated", False):
            # For animated gifs, we can resize and save first frame or copy
            img.seek(0)
        
        # Convert to RGBA
        base = img.convert("RGBA")
        
        # Calculate aspect ratio resize
        w, h = base.size
        scale = min(max_dim / float(w), max_dim / float(h), 1.0)
        new_w, new_h = int(w * scale), int(h * scale)
        base = base.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
        # Create watermark overlay
        watermark_layer = Image.new("RGBA", (new_w, new_h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(watermark_layer)
        
        # Try finding a standard font, fallback to default
        font_size = max(18, int(new_w * 0.035))
        try:
            # Arial or Consolas on Windows
            font = ImageFont.truetype("arial.ttf", font_size)
        except Exception:
            font = ImageFont.load_default()
            
        # Draw repeating diagonal text grid
        # Spacing
        step_x = int(font_size * 5.5)
        step_y = int(font_size * 3.2)
        
        # Fill slightly outside bounds to rotate cleanly
        temp_size = int(max(new_w, new_h) * 1.5)
        temp_layer = Image.new("RGBA", (temp_size, temp_size), (0, 0, 0, 0))
        temp_draw = ImageDraw.Draw(temp_layer)
        
        # Subtle watermark color: white with ~22% opacity + thin black shadow for visibility on any background
        for y in range(0, temp_size, step_y):
            offset = (y // step_y) % 2 * (step_x // 2)
            for x in range(-step_x, temp_size, step_x):
                px = x + offset
                # Shadow
                temp_draw.text((px + 1, y + 1), text, font=font, fill=(0, 0, 0, 40))
                # Text
                temp_draw.text((px, y), text, font=font, fill=(255, 255, 255, 60))
                
        # Rotate watermark by -25 degrees
        rotated = temp_layer.rotate(25, resample=Image.Resampling.BICUBIC)
        
        # Crop rotated watermark to center
        rx = (temp_size - new_w) // 2
        ry = (temp_size - new_h) // 2
        watermark_cropped = rotated.crop((rx, ry, rx + new_w, ry + new_h))
        
        # Composite base and watermark
        combined = Image.alpha_composite(base, watermark_cropped)
        
        # Save as optimized WebP or PNG
        rgb_result = combined.convert("RGB")
        rgb_result.save(dst_path, "JPEG", quality=86, optimize=True)
        print(f"Created: {dst_path} ({new_w}x{new_h})")

def process_gallery(input_dir=DEFAULT_INPUT_DIR, output_dir=DEFAULT_OUTPUT_DIR, files=None):
    os.makedirs(output_dir, exist_ok=True)
    
    if not files:
        # Default showcase if user hasn't specified yet
        candidates = [
            ("NecoArcPTRD.png", "Neco-Arc с ПТРД", "Ручная графика / скетч"),
            ("StalcArc.png", "StalcArc (S.T.A.L.K.E.R.)", "Арт по мотивам Зоны"),
            ("Cat_posing_with_mittens_202607211109.jpeg", "Котейка в варежках", "Иллюстрация"),
            ("neco arc walls.png", "Neco Arc Walls", "Концепт / Обои"),
            ("NecoZ.png", "Neco-Z", "Эксперимент")
        ]
    else:
        candidates = [(f, f, "Работа 47R") for f in files]
        
    gallery_manifest = []
    
    for filename, title, category in candidates:
        src = os.path.join(input_dir, filename)
        if not os.path.exists(src):
            continue
            
        base_name, _ = os.path.splitext(filename)
        out_name = f"thumb_{base_name}.jpg"
        dst = os.path.join(output_dir, out_name)
        
        try:
            create_watermarked_image(src, dst)
            gallery_manifest.append({
                "id": base_name,
                "title": title,
                "category": category,
                "file": f"assets/gallery/{out_name}",
                "watermark": "Protected with 47R pattern"
            })
        except Exception as e:
            print(f"Failed to process {filename}: {e}")
            
    manifest_path = os.path.join(output_dir, "gallery.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(gallery_manifest, f, ensure_ascii=False, indent=2)
    print(f"Saved manifest to {manifest_path}")

if __name__ == "__main__":
    process_gallery()
