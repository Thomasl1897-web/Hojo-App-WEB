"""
Génère l'icône, l'icône adaptative Android, la silhouette monochrome, le favicon et l'écran de démarrage de Hojo.

Icône = version SOMBRE de la planche « Design/Logo et nom Hojo.png » : fond vert foncé, personnage crème,
feuille sauge. Le dessin vient du logo haute définition « Design/Logo app transparent.png » (la planche est
trop petite pour être agrandie à 1024 px), recoloré ici. Le splash garde le logo vert sur fond crème.

Usage : python scripts/make-app-icons.py   (Pillow + numpy)
"""
import os

import numpy as np
from PIL import Image

DESIGN = r"C:\Users\Thomas Lemor\Desktop\App Nutrisport\Design"
OUT = r"C:\Users\Thomas Lemor\Desktop\App Nutrisport\mobile\assets\images"

BACKGROUND = (40, 97, 77)  # #28614D, relevé sur l'icône sombre de la planche
CREAM = (242, 243, 238)  # personnage et haltères

mark = Image.open(os.path.join(DESIGN, "Logo app transparent.png")).convert("RGBA")
pixels = np.asarray(mark).astype(float)

# Le personnage est vert foncé (rouge faible), la feuille vert sauge (rouge plus élevé) : le personnage
# devient crème, la feuille garde sa teinte, avec un passage progressif pour ne pas durcir les bords.
body = np.clip((90 - pixels[..., 0]) / 20, 0, 1)[..., None]
recolored = pixels.copy()
recolored[..., :3] = body * np.array(CREAM) + (1 - body) * pixels[..., :3]
foreground = Image.fromarray(recolored.astype(np.uint8), "RGBA")


def resized(image: Image.Image, size: int) -> Image.Image:
    return image.resize((size, size), Image.LANCZOS)


def save(image: Image.Image, name: str):
    image.save(os.path.join(OUT, name), optimize=True)


solid = Image.new("RGBA", (1024, 1024), BACKGROUND + (255,))

# Icône principale (iOS et vignette) : fond plein + logo.
icon = solid.copy()
icon.alpha_composite(foreground)
save(icon.convert("RGB"), "icon.png")
save(resized(icon, 48).convert("RGB"), "favicon.png")

# Android adaptatif : avant-plan transparent (dans la zone sûre) et fond uni.
save(foreground, "android-icon-foreground.png")
save(solid.convert("RGB"), "android-icon-background.png")

# Monochrome (thème Android 13) : seule la transparence compte, on la garde en blanc.
mono = np.zeros((1024, 1024, 4), dtype=np.uint8)
mono[..., :3] = 255
mono[..., 3] = np.asarray(mark)[..., 3]
save(Image.fromarray(mono, "RGBA"), "android-icon-monochrome.png")

# Écran de démarrage : inchangé, logo vert d'origine sur fond crème (couleur définie dans app.json).
save(resized(mark, 1024), "splash-icon.png")
print("done", "fond", "#%02X%02X%02X" % BACKGROUND)
