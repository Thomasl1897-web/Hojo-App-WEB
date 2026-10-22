"""Découpe la silhouette musculaire (Design/Heatmap muscles.png) en une image-masque par groupe musculaire.

Usage (Python 3 + Pillow) :  python scripts/make-muscle-masks.py

Principe : la planche dessine chaque muscle en gris, séparé des autres par un trait blanc. On repère les
zones grises connexes ("composantes"), puis on rattache chaque composante à un groupe musculaire de l'app
(`MUSCLE_GROUPS` dans src/lib/exercise-catalog.ts). Quelques composantes dessinent plusieurs muscles d'un
bloc (jambe entière, bras entier, tête + trapèzes) : elles sont coupées à la main par tranches de hauteur.

Sortie :
  assets/images/muscles/{front,back}/<groupe>.png  masques blancs sur fond transparent (teintés à l'exécution)
  assets/images/muscles/{front,back}/base.png      silhouette entière (tête, mains, pieds compris)
  src/constants/muscle-masks.ts                     table des images (généré)
  --preview chemin.png                              aperçu coloré pour vérifier les rattachements
"""
import glob
import os
import sys

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DESIGN = os.path.abspath(os.path.join(ROOT, '..', 'Design'))
OUT = os.path.join(ROOT, 'assets', 'images', 'muscles')

SOURCE = [p for p in glob.glob(os.path.join(DESIGN, '*.png')) if 'Heatmap' in os.path.basename(p)][0]

# Cadres des deux silhouettes dans la planche (même taille pour que les images se superposent).
VIEWS = {
    'front': (40, 10, 620, 1190),
    'back': (690, 10, 1270, 1190),
}
THRESHOLD = 200       # en dessous : pixel de muscle
FILL_LUMINANCE = 135  # gris du remplissage : alpha plein à partir de là
MIN_COMPONENT = 400   # en dessous : poussière, ignorée

# Rattachement des composantes (numérotées dans l'ordre de balayage de l'image) aux groupes.
IGNORE = 'ignore'  # tête, cou, mains, pieds : dans la silhouette, mais pas un groupe


def front_group(label, x, y):
    if label in (5, 6):
        return 'traps'
    if label in (11, 12):
        return 'shoulders'
    if label in (13, 14):
        return 'chest'
    if label in (25, 26, 31, 32, 41, 42, 51, 52, 57):
        return 'abs'
    if label in (21, 22):
        return 'obliques'
    if label == 17:  # bras de gauche : biceps jusqu'au pli du coude, avant-bras en dessous
        return 'biceps' if y < 440 else 'forearms'
    if label == 33:
        return 'biceps'
    if label in (40, 43):
        return 'forearms'
    if label == 50:  # avant-bras + main
        return 'forearms' if y < 590 else IGNORE
    if label == 18:  # bras de droite : biceps / avant-bras / main d'un bloc
        if y < 445:
            return 'biceps'
        return 'forearms' if y < 588 else IGNORE
    if label in (66, 67):
        return 'adductors'
    if label in (53, 54):  # jambe entière : cuisse (genou compris), mollet, pied
        if y < 895:
            return 'quads'
        return 'calves' if y < 1085 else IGNORE
    if label == 75:
        return 'calves'
    return IGNORE  # tête (1), cou (7)


def back_group(label, x, y):
    if label == 2:  # tête + cou + trapèzes d'un bloc
        return IGNORE if y < 140 else 'traps'
    if label in (3, 4):
        return 'traps'
    if label in (9, 10):
        return 'shoulders'
    if label in (15, 16, 23, 24):
        return 'lats'
    if label in (27, 28):
        return 'lowerBack'
    if label in (36, 37):
        return 'obliques'
    if label in (55, 56, 58, 63):
        return 'glutes'
    if label in (62, 68, 69, 70):
        return 'hamstrings'
    if label in (71, 72):  # mollet entier : bas de l'ischio, mollet, pied
        if y < 838:
            return 'hamstrings'
        return 'calves' if y < 1100 else IGNORE
    if label in (19, 20, 29, 30):
        return 'triceps'
    if label in (34, 35, 38, 39, 46, 47, 48):
        return 'forearms'
    return IGNORE  # mains (64, 65)


def label_components(lum, width, height):
    """Composantes connexes des pixels sombres. Renvoie (labels, tailles)."""
    labels = [0] * (width * height)
    sizes = {}
    current = 0
    for start in range(width * height):
        if lum[start] >= THRESHOLD or labels[start]:
            continue
        current += 1
        stack = [start]
        labels[start] = current
        count = 0
        while stack:
            p = stack.pop()
            count += 1
            y, x = divmod(p, width)
            if x > 0 and not labels[p - 1] and lum[p - 1] < THRESHOLD:
                labels[p - 1] = current
                stack.append(p - 1)
            if x < width - 1 and not labels[p + 1] and lum[p + 1] < THRESHOLD:
                labels[p + 1] = current
                stack.append(p + 1)
            if y > 0 and not labels[p - width] and lum[p - width] < THRESHOLD:
                labels[p - width] = current
                stack.append(p - width)
            if y < height - 1 and not labels[p + width] and lum[p + width] < THRESHOLD:
                labels[p + width] = current
                stack.append(p + width)
        sizes[current] = count
    return labels, sizes


def main():
    preview_path = None
    if '--preview' in sys.argv:
        preview_path = sys.argv[sys.argv.index('--preview') + 1]

    image = Image.open(SOURCE).convert('L')
    width, height = image.size
    lum = list(image.getdata())
    print('image', width, 'x', height, '-', SOURCE)

    labels, sizes = label_components(lum, width, height)
    print('composantes :', len(sizes), '(dont', sum(1 for n in sizes.values() if n >= MIN_COMPONENT), 'assez grandes)')

    # Groupe de chaque pixel de muscle, puis propagation aux pixels de bord (anti-crénelage).
    group = [None] * (width * height)
    for p in range(width * height):
        label = labels[p]
        if label and sizes[label] >= MIN_COMPONENT:
            y, x = divmod(p, width)
            group[p] = (front_group if x < width // 2 else back_group)(label, x, y)
    for _ in range(2):
        updates = {}
        for p in range(width * height):
            if group[p] is not None or lum[p] >= 252:
                continue
            y, x = divmod(p, width)
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < width and 0 <= yy < height and group[yy * width + xx] is not None:
                        updates[p] = group[yy * width + xx]
                        break
                if p in updates:
                    break
        for p, value in updates.items():
            group[p] = value

    def alpha_of(p):
        a = (255 - lum[p]) / (255 - FILL_LUMINANCE)
        return max(0.0, min(1.0, a))

    names_by_view = {}
    preview = Image.new('RGB', (width, height), (255, 255, 255)) if preview_path else None
    palette = {}
    for view, (x0, y0, x1, y1) in VIEWS.items():
        folder = os.path.join(OUT, view)
        os.makedirs(folder, exist_ok=True)
        for old in glob.glob(os.path.join(folder, '*.png')):
            os.remove(old)
        w, h = x1 - x0, y1 - y0
        layers = {}
        base = Image.new('RGBA', (w, h), (255, 255, 255, 0))
        base_px = base.load()
        for y in range(h):
            for x in range(w):
                p = (y + y0) * width + (x + x0)
                g = group[p]
                if g is None:
                    continue
                a = alpha_of(p)
                if a <= 0.01:
                    continue
                value = int(round(a * 255))
                base_px[x, y] = (255, 255, 255, value)
                if g != IGNORE:
                    layer = layers.get(g)
                    if layer is None:
                        layer = layers[g] = Image.new('RGBA', (w, h), (255, 255, 255, 0))
                    layer.putpixel((x, y), (255, 255, 255, value))
                if preview is not None:
                    color = palette.setdefault(g, ((len(palette) * 67 + 40) % 215 + 20, (len(palette) * 131 + 90) % 215 + 20, (len(palette) * 29 + 150) % 215 + 20))
                    bg = preview.getpixel((x + x0, y + y0))
                    preview.putpixel((x + x0, y + y0), tuple(int(bg[i] * (1 - a) + color[i] * a) for i in range(3)))
        base.save(os.path.join(folder, 'base.png'), optimize=True)
        for g, layer in layers.items():
            layer.save(os.path.join(folder, g + '.png'), optimize=True)
        names_by_view[view] = sorted(layers)
        print(view, ':', ', '.join(names_by_view[view]))

    if preview is not None:
        preview.save(preview_path)
        print('aperçu :', preview_path, palette)

    # Table des images pour l'app.
    lines = [
        '// Généré par scripts/make-muscle-masks.py — ne pas modifier à la main.',
        "import type { MuscleGroup } from '@/lib/exercise-catalog';",
        '',
        '/** Taille des images de la silhouette (identique pour tous les masques d\'une même vue). */',
        'export const MASK_WIDTH = %d;' % (VIEWS['front'][2] - VIEWS['front'][0]),
        'export const MASK_HEIGHT = %d;' % (VIEWS['front'][3] - VIEWS['front'][1]),
        '',
        "export type MuscleView = 'front' | 'back';",
        '',
        'type ViewMasks = { base: number; groups: Partial<Record<MuscleGroup, number>> };',
        '',
        'export const MUSCLE_MASKS: Record<MuscleView, ViewMasks> = {',
    ]
    for view in VIEWS:
        lines.append('  %s: {' % view)
        lines.append("    base: require('@/assets/images/muscles/%s/base.png')," % view)
        lines.append('    groups: {')
        for g in names_by_view[view]:
            lines.append("      %s: require('@/assets/images/muscles/%s/%s.png')," % (g, view, g))
        lines.append('    },')
        lines.append('  },')
    lines.append('};')
    target = os.path.join(ROOT, 'src', 'constants', 'muscle-masks.ts')
    with open(target, 'w', encoding='utf-8', newline='\n') as handle:
        handle.write('\n'.join(lines) + '\n')
    print('écrit :', target)


if __name__ == '__main__':
    main()
