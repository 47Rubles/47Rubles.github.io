#!/usr/bin/env python3
"""
Neco Arc Sprite & Audio Extractor for Web
-----------------------------------------
Extracts, aligns, and crops Neco-Arc sprites to lightweight web-ready PNGs,
and copies iconic voice lines to assets/audio.
"""

import os
import shutil
import json
from PIL import Image

SRC_BASE = r"C:\Users\tchul\OneDrive\Рабочий стол\Склад\Fото\Neco base"
AUDIO_BASE = r"C:\Users\tchul\OneDrive\Рабочий стол\Склад\Neco-Arc"

DST_NECO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "assets", "neco"))
DST_AUDIO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "assets", "audio"))

os.makedirs(DST_NECO, exist_ok=True)
os.makedirs(DST_AUDIO, exist_ok=True)

# Fixed alignment anchor: center x=475, bottom y=675
# Crop box width 160, height 180 (centered on anchor)
ANCHOR_X = 475
ANCHOR_Y = 675
CROP_W = 160
CROP_H = 180

LEFT = ANCHOR_X - (CROP_W // 2)
TOP = ANCHOR_Y - CROP_H
RIGHT = ANCHOR_X + (CROP_W // 2)
BOTTOM = ANCHOR_Y

def extract_animation(name, frame_indices, speed_ms=100):
    frames = []
    for idx, f_num in enumerate(frame_indices):
        src_path = os.path.join(SRC_BASE, f"neco_0-{f_num}.png")
        if not os.path.exists(src_path):
            continue
        
        with Image.open(src_path) as img:
            # Crop to anchor
            cropped = img.crop((LEFT, TOP, RIGHT, BOTTOM))
            out_filename = f"{name}_{idx}.png"
            dst_path = os.path.join(DST_NECO, out_filename)
            cropped.save(dst_path, "PNG", optimize=True)
            frames.append(f"assets/neco/{out_filename}")
            
    return {
        "frames": frames,
        "speed": speed_ms
    }

def main():
    manifest = {}
    
    # 1. Idle (frames 0 to 8)
    manifest["idle"] = extract_animation("idle", list(range(0, 9)), speed_ms=120)
    
    # 2. Walk (frames 15 to 24)
    manifest["walk"] = extract_animation("walk", list(range(15, 25)), speed_ms=80)
    
    # 3. Run / Dash (frames 25 to 31)
    manifest["run"] = extract_animation("run", list(range(25, 32)), speed_ms=65)
    
    # 4. Turn / Notice (frames 9 to 14)
    manifest["turn"] = extract_animation("turn", list(range(9, 15)), speed_ms=90)
    
    # 5. Sleep / Flat (frames 220 to 228)
    manifest["sleep"] = extract_animation("sleep", list(range(220, 229)), speed_ms=200)
    
    # 6. Action / Shock (frames 52 to 57)
    manifest["shock"] = extract_animation("shock", list(range(52, 58)), speed_ms=90)

    # Save manifest
    manifest_path = os.path.join(DST_NECO, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"Extracted {len(manifest)} animation states to {DST_NECO}")
    
    # Copy sound files
    sound_mappings = [
        (os.path.join(AUDIO_BASE, "Chat", "chr019_00_4400.wav"), "burunyuu.wav"),
        (os.path.join(AUDIO_BASE, "Selection", "chr019_00_4000.wav"), "nya.wav"),
        (os.path.join(AUDIO_BASE, "Miscellaneous", "chr019_00_4300.wav"), "alert.wav"),
        (os.path.join(AUDIO_BASE, "Battle", "nec00_2000.wav"), "angry.wav"),
        (os.path.join(AUDIO_BASE, "Battle", "nec00_2003.wav"), "laugh.wav")
    ]
    
    for src, dst_name in sound_mappings:
        if os.path.exists(src):
            dst = os.path.join(DST_AUDIO, dst_name)
            shutil.copyfile(src, dst)
            print(f"Copied audio: {dst_name}")

if __name__ == "__main__":
    main()
