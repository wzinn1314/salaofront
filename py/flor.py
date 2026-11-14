"""Lirio branco de partículas: Python + NumPy + Pillow + Tkinter.
Execute: python py/flor.py
Prévia: python py/flor.py --preview outputs/flor-vermelha.png --time 7
"""
from __future__ import annotations

import argparse
from pathlib import Path
import time

try:
    import numpy as np
    from PIL import Image, ImageTk, ImageDraw
except ImportError:
    raise SystemExit('Instale as dependências: python -m pip install -r py/requirements.txt')

TAU = 2 * np.pi
CYCLE = 14.0


def smooth(value):
    value = np.clip(value, 0.0, 1.0)
    return value * value * (3.0 - 2.0 * value)


class ParticleFlower:
    """Geometria pré-calculada e projeção vetorizada, sem laços por partícula."""

    def __init__(self, seed=24):
        rng = np.random.default_rng(seed)
        # Seis tepalas longas em duas camadas alternadas formam o lirio.
        rings, angles, lengths, across = [], [], [], []
        for petal in range(6):
            sample = np.arange(14560)
            petal_u = np.concatenate((((sample % 112) + rng.random(14560)) / 112,
                                      np.linspace(0.003, 0.997, 172), np.linspace(0.003, 0.997, 172)))
            petal_v = np.concatenate(((((sample // 112) + rng.random(14560)) / 130) * 2 - 1,
                                      np.full(172, -0.998), np.full(172, 0.998)))
            n = len(petal_u)
            rings.extend([petal % 2] * n)
            angles.extend([petal * TAU / 6 + np.pi / 6] * n)
            lengths.extend(petal_u)
            across.extend(petal_v)
        ring = np.asarray(rings, dtype=np.float32)
        u = np.asarray(lengths, dtype=np.float32)
        v = np.asarray(across, dtype=np.float32)
        angle = np.asarray(angles, dtype=np.float32)
        side = v * np.sin(np.pi * u) ** 0.85
        a = angle
        radius = (1.18 - ring * 0.06) * u
        petal_width = side * (0.36 - ring * 0.035)
        self.petal_open_x = np.cos(a) * radius - np.sin(a) * petal_width
        self.petal_open_z = np.sin(a) * radius + np.cos(a) * petal_width
        self.petal_open_y = 0.40 * np.sin(np.pi * u) - 0.20 * u ** 4
        self.petal_open_y += 0.12 * v ** 2 * np.sin(np.pi * u) + ring * 0.07
        # A abertura fica voltada para quem olha, em vez de apontar para cima.
        front_angle = np.float32(-1.15)
        front_cos, front_sin = np.cos(front_angle), np.sin(front_angle)
        open_y = self.petal_open_y.copy()
        open_z = self.petal_open_z.copy()
        self.petal_open_y = open_y * front_cos - open_z * front_sin
        self.petal_open_z = open_y * front_sin + open_z * front_cos
        self.petal_closed_x = np.cos(a) * (0.09 + ring * 0.006) * np.sin(u * np.pi * 0.65)
        self.petal_closed_z = np.sin(a) * (0.09 + ring * 0.006) * np.sin(u * np.pi * 0.65)
        self.petal_closed_y = (0.96 - ring * 0.08) * u
        self.petal_ring = ring
        self.petal_edge = np.clip(np.abs(v) * 0.5 + smooth((u - 0.8) / 0.2) * 0.5, 0, 1)
        self.n_petals = len(u)
        self.petal_density_rank = rng.random(self.n_petals).astype(np.float32)
        stem_n, leaves_n, center_n, ground_n = 4800, 6400, 2400, 48000
        self.groups = {}
        cursor = 0
        for name, count in [('petals', self.n_petals), ('stem', stem_n), ('leaves', leaves_n),
                            ('center', center_n), ('ground', ground_n), ('auras', 5000)]:
            self.groups[name] = slice(cursor, cursor + count)
            cursor += count
        self.count = cursor
        self.points = np.empty((cursor, 3), dtype=np.float32)
        self.colors = np.empty((cursor, 3), dtype=np.float32)
        self.seed_light = rng.uniform(0.38, 1.0, cursor).astype(np.float32)
        self.shimmer_phase = rng.uniform(0, TAU, cursor).astype(np.float32)
        self.colors[:] = (255, 250, 235)
        self.colors[self.groups['stem']] = (45, 220, 85)
        self.colors[self.groups['leaves']] = (45, 190, 75)
        self.colors[self.groups['center']] = (255, 191, 56)
        self.colors[self.groups['ground']] = (48, 154, 35)
        self.colors[self.groups['auras']] = (255, 230, 166)
        self.aura_angle = np.tile(np.linspace(0, TAU, 1000, endpoint=False, dtype=np.float32), 5)
        self.aura_id = np.repeat(np.arange(5, dtype=np.float32), 1000)
        self.aura_jitter = rng.normal(0, 0.012, (5000, 3)).astype(np.float32)
        self.aura_rank = rng.random(5000).astype(np.float32)
        self.center_rank = rng.random(center_n).astype(np.float32)
        # Garganta dourada suave e nervuras claras nas petalas brancas.
        throat = np.exp(-u * 6)
        self.colors[:self.n_petals, 1] = 250 - throat * 38
        self.colors[:self.n_petals, 2] = 240 - throat * 130
        self.seed_light[:self.n_petals] = rng.uniform(0.85, 1.0, self.n_petals)
        self.seed_light[:self.n_petals] *= 0.90 + 0.10 * np.cos(v * np.pi * 4) ** 2
        self.stem_t = np.repeat(np.linspace(0, 1, 300, dtype=np.float32), 16)
        theta = np.tile(np.linspace(0, TAU, 16, endpoint=False, dtype=np.float32), 300)
        self.stem_x = (np.cos(theta) * 0.018).astype(np.float32)
        self.stem_z = (np.sin(theta) * 0.018).astype(np.float32)
        leaf_id = np.repeat(np.arange(4), leaves_n // 4)
        self.leaf_h = np.array([0.13, 0.23, 0.48, 0.57], dtype=np.float32)[leaf_id]
        leaf_dir = np.array([0.1, 3.2, 0.15, 3.3], dtype=np.float32)[leaf_id]
        leaf_size = np.array([0.7, 0.7, 0.5, 0.51], dtype=np.float32)[leaf_id]
        leaf_sample = np.tile(np.arange(1600), 4)
        leaf_u = ((leaf_sample % 50 + rng.random(leaves_n)) / 50).astype(np.float32)
        leaf_v = (((leaf_sample // 50 + rng.random(leaves_n)) / 32) * 2 - 1).astype(np.float32)
        leaf_r = leaf_u * leaf_size
        leaf_w = np.sin(np.pi * leaf_u) ** 0.75 * 0.30 * leaf_size * leaf_v
        self.leaf_x = np.cos(leaf_dir) * leaf_r - np.sin(leaf_dir) * leaf_w
        self.leaf_z = np.sin(leaf_dir) * leaf_r + np.cos(leaf_dir) * leaf_w
        self.leaf_y = np.sin(leaf_u * np.pi * 0.8) * 0.34 * leaf_size + leaf_w * 0.85
        self.leaf_z *= 0.45
        # Seis estames dourados com anteras alongadas nas pontas.
        stamen_id = np.repeat(np.arange(6), 400)
        stamen_t = np.tile(np.concatenate((np.linspace(0, 1, 240), np.ones(160))), 6)
        stamen_a = stamen_id * TAU / 6
        tube_angle = rng.uniform(0, TAU, center_n)
        tip = np.tile(np.arange(400) >= 240, 6)
        tube_radius = np.where(tip, 0.032, 0.008)
        self.center_x = np.cos(stamen_a) * stamen_t * 0.21 + np.cos(tube_angle) * tube_radius
        self.center_z = np.sin(stamen_a) * stamen_t * 0.21 + np.sin(tube_angle) * tube_radius
        self.center_y = 0.07 + stamen_t * 0.48 + np.where(tip, rng.uniform(-0.065, 0.065, center_n), 0)
        self.center_open_y = self.center_y * front_cos - self.center_z * front_sin
        self.center_open_z = self.center_y * front_sin + self.center_z * front_cos
        # Calota verde densa, coberta por laminas curvas de grama.
        turf_n, blades_n, blade_samples = 18000, 1500, 20
        turf_angle = rng.uniform(0, TAU, turf_n)
        turf_r = np.sqrt(rng.random(turf_n))
        turf_x = np.cos(turf_angle) * turf_r * 0.95
        turf_z = np.sin(turf_angle) * turf_r * 0.58
        turf_y = -1.82 + 0.30 * (1 - turf_r ** 2)
        blade_angle = rng.uniform(0, TAU, blades_n)
        blade_r = np.sqrt(rng.random(blades_n))
        root_x = np.cos(blade_angle) * blade_r * 0.95
        root_z = np.sin(blade_angle) * blade_r * 0.58
        root_y = -1.82 + 0.30 * (1 - blade_r ** 2)
        t = np.tile(np.linspace(0, 1, blade_samples), blades_n)
        bend = np.repeat(rng.uniform(0, TAU, blades_n), blade_samples)
        length = np.repeat(rng.uniform(0.055, 0.18, blades_n), blade_samples)
        blade_x = np.repeat(root_x, blade_samples) + np.cos(bend) * length * t ** 2 * 0.55
        blade_z = np.repeat(root_z, blade_samples) + np.sin(bend) * length * t ** 2 * 0.55
        blade_y = np.repeat(root_y, blade_samples) + length * (t - 0.2 * t ** 2)
        self.ground = np.column_stack((np.concatenate((turf_x, blade_x)),
                                       np.concatenate((turf_y, blade_y)),
                                       np.concatenate((turf_z, blade_z)))).astype(np.float32)
        grass_colors = self.colors[self.groups['ground']]
        shade = rng.uniform(0.65, 1.0, turf_n)
        grass_colors[:turf_n] = np.column_stack((30 * shade, 106 * shade, 24 * shade))
        blade_shade = np.repeat(rng.uniform(0.65, 1.0, blades_n), blade_samples)
        grass_colors[turf_n:] = np.column_stack(((38 + 38 * t) * blade_shade,
                                                 (135 + 65 * t) * blade_shade,
                                                 (25 + 22 * t) * blade_shade))
        self.brightness_scale = np.ones(cursor, dtype=np.float32)
        self.seed_light[self.groups['ground']] = 1.0
        self.seed_light[self.groups['stem']] = rng.uniform(0.8, 1.0, stem_n)
        self.seed_light[self.groups['leaves']] = rng.uniform(0.72, 1.0, leaves_n)
        # Iluminacao diferente em cada petala ajuda a separar as camadas.
        self.seed_light[:self.n_petals] *= 0.65 + 0.35 * (np.cos(angle - 0.6) * 0.5 + 0.5)
        self._buffer_size = None

    def frame(self, seconds, width, height):
        phase = np.float32(TAU * (seconds % CYCLE) / CYCLE)
        elapsed = seconds % CYCLE
        # Broto, crescimento do caule, abertura e pausa com a flor aberta.
        development = elapsed if elapsed <= 7 else (7.0 if elapsed <= 9 else 7.0 * (CYCLE - elapsed) / 5.0)
        growth = 0.025 + 0.975 * float(smooth(development / 4.5))
        bloom = float(smooth((development - 3.5) / 3.5))
        bud_scale = 0.055 + 0.945 * float(smooth(development / 4.8))
        lean = 0.0  # Caule sempre reto, desde o broto ate a abertura.
        base_y = -1.56
        stem_height = 2.11 * growth
        top_y = base_y + stem_height
        p = self.points
        s = self.groups['stem']
        p[s, 0] = lean * self.stem_t ** 2 + self.stem_x
        p[s, 1] = base_y + stem_height * self.stem_t
        p[s, 2] = self.stem_z
        s = self.groups['leaves']
        p[s, 0] = self.leaf_x * growth + lean * self.leaf_h ** 2
        p[s, 1] = base_y + stem_height * self.leaf_h + self.leaf_y * growth
        p[s, 2] = self.leaf_z * growth
        s = self.groups['petals']
        opening = np.clip((bloom - self.petal_ring * 0.025) / (1 - self.petal_ring * 0.025), 0, 1)
        x = self.petal_closed_x * (1 - opening) + self.petal_open_x * opening
        z = self.petal_closed_z * (1 - opening) + self.petal_open_z * opening
        y = self.petal_closed_y * (1 - opening) + self.petal_open_y * opening
        x, y, z = x * bud_scale, y * bud_scale, z * bud_scale
        tilt = np.float32(0.0)
        ct, st = np.cos(tilt), np.sin(tilt)
        p[s, 0] = lean + x * ct + y * st
        p[s, 1] = top_y - x * st + y * ct
        p[s, 2] = z
        s = self.groups['center']
        center_y = self.center_y * (1 - bloom) + self.center_open_y * bloom
        p[s, 0] = lean + self.center_x * ct + center_y * st
        p[s, 1] = top_y - self.center_x * st + center_y * ct
        p[s, 2] = self.center_z * (1 - bloom) + self.center_open_z * bloom
        p[self.groups['ground']] = self.ground
        # Cinco grandes circulos em planos diferentes giram como um globo.
        # A mesma projecao 3D coloca os arcos a frente e atras do lirio.
        longitude = self.aura_id * np.pi / 5
        orbit_angle = self.aura_angle + phase * (1 + self.aura_id * 0.2)
        orbit_radius = 1.42 * (0.28 + 0.72 * bloom)
        globe_x = np.cos(orbit_angle) * np.cos(longitude) * orbit_radius
        globe_z = np.cos(orbit_angle) * np.sin(longitude) * orbit_radius
        globe_y = np.sin(orbit_angle) * orbit_radius
        spin = phase
        gx = globe_x * np.cos(spin) + globe_z * np.sin(spin)
        gz = -globe_x * np.sin(spin) + globe_z * np.cos(spin)
        nod = 0.40 * np.sin(phase)
        s = self.groups['auras']
        p[s, 0] = lean + gx
        p[s, 1] = top_y - 0.10 + globe_y * np.cos(nod) - gz * np.sin(nod)
        p[s, 2] = globe_y * np.sin(nod) + gz * np.cos(nod)
        p[s] += self.aura_jitter
        # A câmera oscila devagar; não faz a flor girar como um objeto rígido.
        rotation = np.float32(0.0)
        cr, sr = np.cos(rotation), np.sin(rotation)
        rx = p[:, 0] * cr + p[:, 2] * sr
        rz = -p[:, 0] * sr + p[:, 2] * cr
        tilt_camera = np.float32(0.14)
        ry = p[:, 1] * np.cos(tilt_camera) - rz * np.sin(tilt_camera)
        depth = p[:, 1] * np.sin(tilt_camera) + rz * np.cos(tilt_camera)
        perspective = 7.5 / (7.5 + depth)
        scale = min(width / 4.2, height / 3.9)
        px = np.rint(width * 0.5 + rx * scale * perspective).astype(np.int32)
        py = np.rint(height * 0.49 - ry * scale * perspective).astype(np.int32)
        visible = (px > 1) & (px < width - 2) & (py > 1) & (py < height - 2)
        # Mais pontos aparecem gradualmente conforme as petalas se abrem.
        visible[:self.n_petals] &= self.petal_density_rank < (0.52 + 0.48 * bloom)
        # O miolo fica recolhido enquanto a flor esta abaixada e surge na subida.
        center_reveal = float(smooth((bloom - 0.22) / 0.38))
        visible[self.groups['center']] &= self.center_rank < center_reveal
        # Na referencia, orbitas pontilhadas surgem junto com a abertura,
        # em vez de uma grade solida permanentemente ao redor da flor.
        aura_reveal = float(smooth((bloom - 0.08) / 0.30))
        visible[self.groups['auras']] &= self.aura_rank < 0.48 * aura_reveal
        shimmer = 0.97 + 0.03 * np.sin(phase * 2 + self.shimmer_phase)
        light = np.clip((0.95 - depth * 0.08) * self.seed_light * shimmer * self.brightness_scale, 0, 1)
        rgb = (self.colors * light[:, None]).astype(np.uint8)[visible]
        index = py[visible] * width + px[visible]
        if self._buffer_size != (width, height):
            self._buffer = np.empty(height * width, dtype=np.uint32)
            self._buffer_size = (width, height)
        pixels = self._buffer
        pixels.fill(255)
        # Uma unica operacao por cor, em vez de tres canais separados.
        # Isso permite aumentar a densidade sem triplicar o custo do desenho.
        color = rgb.astype(np.uint32)
        packed = (color[:, 0] << 24) | (color[:, 1] << 16) | (color[:, 2] << 8) | 255
        # A petala da frente cobre a de tras: contornos mais definidos,
        # em vez de misturar todas as camadas pelo brilho.
        # Profundidade em inteiros usa ordenacao radix, mais leve que ordenar
        # valores flutuantes; preserva as mesmas particulas e a sobreposicao.
        depth_key = np.clip((depth[visible] + 4) * 4096, 0, 65535).astype(np.uint16)
        order = np.argsort(depth_key, kind='stable')[::-1]
        pixels[index[order]] = packed[order]
        surface = pixels.reshape(height, width)
        # Halo calculado na imagem pronta, sem repetir todas as particulas.
        soft = ((surface & np.uint32(0xFCFCFC00)) >> 2) | np.uint32(255)
        np.maximum(surface[:, 1:], soft[:, :-1], out=surface[:, 1:])
        np.maximum(surface[:, :-1], soft[:, 1:], out=surface[:, :-1])
        np.maximum(surface[1:, :], soft[:-1, :], out=surface[1:, :])
        np.maximum(surface[:-1, :], soft[1:, :], out=surface[:-1, :])
        # Brilho restrito a um pixel; fundo inteiramente preto.
        rgba = pixels.astype('>u4').view(np.uint8).reshape(height, width, 4)
        return Image.fromarray(rgba)


class ThalitaGarden:
    """Um grande morro de grama com lirios vivos desenhando cada letra."""

    def __init__(self):
        self.flower = ParticleFlower()
        self.flower.aura_rank[:] = 1
        self.count = self.flower.count
        letters = {
            't': ['00100', '00100', '11111', '00100', '00100', '00100', '00011'],
            'h': ['10000', '10000', '10110', '11001', '10001', '10001', '10001'],
            'a': ['00000', '00000', '01110', '00001', '01111', '10001', '01111'],
            'l': ['01100', '00100', '00100', '00100', '00100', '00100', '00010'],
            'i': ['00100', '00000', '01100', '00100', '00100', '00100', '01110'],
        }
        self.blooms = [(letter * 6 + col, row)
                       for letter, char in enumerate('thalita')
                       for row, line in enumerate(letters[char])
                       for col, value in enumerate(line) if value == '1']
        self.background = None

    def grass(self, width, height):
        image = Image.new('RGBA', (width, height), 'black')
        draw = ImageDraw.Draw(image)
        # O morrinho ocupa quase toda a largura e sustenta o nome inteiro.
        draw.ellipse((width * 0.025, height * 0.10, width * 0.975, height * 1.10),
                     fill=(16, 60, 18))
        rng = np.random.default_rng(81)
        for _ in range(22000):
            x, y = rng.uniform(-1, 1), rng.uniform(-1, 1)
            if x*x + y*y > 1:
                continue
            px = width * (0.5 + x * 0.47)
            py = height * (0.60 + y * 0.49)
            length = rng.uniform(0.006, 0.024) * height
            shade = rng.uniform(0.55, 1)
            color = (int(48 * shade), int(132 * shade), int(33 * shade))
            draw.line([(px, py), (px + length * 0.15, py - length * 0.55),
                       (px + length * rng.uniform(-0.5, 0.5), py - length)],
                      fill=color, width=1)
        return image

    def frame(self, seconds, width, height):
        if self.background is None or self.background.size != (width, height):
            self.background = self.grass(width, height)
        image = self.background.copy()
        draw = ImageDraw.Draw(image)
        elapsed = seconds % CYCLE
        development = elapsed if elapsed <= 7 else (7 if elapsed <= 9 else 7 * (CYCLE - elapsed) / 5)
        growth = float(smooth(development / 4.5))
        cell = min(width * 0.92 / 41, height * 0.065)
        left = (width - cell * 40) / 2
        top = height * 0.42
        # Uma flor renderizada por quadro e reutilizada em todas as letras.
        source = self.flower.frame(seconds, 240, 240)
        # Recorte da corola: remove o chao e as folhas da flor original.
        stem_top = -1.56 + 2.11 * (0.025 + 0.975 * growth)
        center_y = 240 * 0.49 - stem_top * (240 / 4.2)
        source = source.crop((42, int(center_y - 76), 198, int(center_y + 76)))
        alpha = np.asarray(source).copy()
        alpha[:, :, 3] = np.where(np.max(alpha[:, :, :3], axis=2) > 15, 255, 0)
        alpha[:, :, :3] = np.clip(alpha[:, :, :3].astype(np.float32) * 1.8, 0, 255).astype(np.uint8)
        sprite = Image.fromarray(alpha).resize((max(2, round(cell * 1.60)),) * 2,
                                              Image.Resampling.LANCZOS)
        for col, row in self.blooms:
            x = left + col * cell
            root = top + row * cell * 1.62 + cell * 0.8
            y = root - cell * 1.05 * growth
            draw.line((x, root, x, y), fill=(65, 185, 60), width=max(1, round(cell * 0.07)))
            if growth > 0.2:
                draw.line((x, root - cell * 0.2 * growth,
                           x - cell * 0.22 * growth, root - cell * 0.4 * growth),
                          fill=(75, 185, 55), width=max(1, round(cell * 0.10)))
            image.alpha_composite(sprite, (round(x - sprite.width / 2), round(y - sprite.height / 2)))
        return image


def launch(width, height):
    import queue
    import threading
    import tkinter as tk

    root = tk.Tk()
    root.title('Lirio no morrinho de grama')
    root.geometry(f'{width}x{height}')
    root.minsize(480, 480)
    canvas = tk.Canvas(root, bg='black', highlightthickness=0)
    canvas.pack(fill='both', expand=True)
    picture = canvas.create_image(0, 0, anchor='center')
    flower = ParticleFlower()
    jobs, results = queue.Queue(maxsize=1), queue.Queue(maxsize=1)
    stop = threading.Event()
    photo = None
    photo_size = None
    elapsed, previous = 0.0, time.perf_counter()
    paused, fullscreen = False, False
    generation = 0
    render_limit = 900

    def replace_latest(destination, value):
        try:
            destination.put_nowait(value)
        except queue.Full:
            try:
                destination.get_nowait()
            except queue.Empty:
                pass
            try:
                destination.put_nowait(value)
            except queue.Full:
                pass

    def renderer():
        while not stop.is_set():
            try:
                serial, instant, w, h = jobs.get(timeout=0.1)
            except queue.Empty:
                continue
            try:
                image = flower.frame(instant, w, h)
                replace_latest(results, (serial, image, None))
            except Exception as error:
                replace_latest(results, (serial, None, str(error)))

    def pause(_event=None):
        nonlocal paused
        paused = not paused

    def restart(_event=None):
        nonlocal elapsed, generation
        elapsed = 0.0
        generation += 1

    def toggle_fullscreen(_event=None):
        nonlocal fullscreen
        fullscreen = not fullscreen
        root.attributes('-fullscreen', fullscreen)

    def tick():
        nonlocal elapsed, previous, photo, photo_size
        started = time.perf_counter()
        if not paused:
            elapsed += min(started - previous, 0.25)
        previous = started
        w, h = canvas.winfo_width(), canvas.winfo_height()
        if w > 1 and h > 1:
            ratio = min(1.0, render_limit / max(w, h))
            rw, rh = max(1, int(w * ratio)), max(1, int(h * ratio))
            if not paused or photo is None:
                replace_latest(jobs, (generation, elapsed, rw, rh))
            try:
                serial, frame, error = results.get_nowait()
                if error:
                    root.title('Erro no desenho: ' + error)
                elif serial == generation:
                    if photo is None or photo_size != frame.size:
                        photo = ImageTk.PhotoImage(frame)
                        photo_size = frame.size
                        canvas.itemconfigure(picture, image=photo)
                    else:
                        photo.paste(frame)
            except queue.Empty:
                pass
            canvas.coords(picture, w / 2, h / 2)
        # Desenho fora da interface, uma unica imagem pendente e nenhum atraso
        # acumulado. Todos os pontos sao mantidos em cada quadro calculado.
        root.after(max(1, round(1000 / 60 - (time.perf_counter() - started) * 1000)), tick)

    def close(_event=None):
        stop.set()
        root.destroy()

    root.bind('<space>', pause)
    root.bind('<r>', restart)
    root.bind('<R>', restart)
    root.bind('<F11>', toggle_fullscreen)
    root.bind('<Escape>', close)
    root.protocol('WM_DELETE_WINDOW', close)
    threading.Thread(target=renderer, daemon=True).start()
    root.after(40, tick)
    try:
        root.mainloop()
    finally:
        stop.set()


def main():
    parser = argparse.ArgumentParser(description='Lirio branco de partículas, com renderização vetorizada.')
    parser.add_argument('--preview', type=Path)
    parser.add_argument('--time', type=float, default=7.0)
    parser.add_argument('--width', type=int, default=900)
    parser.add_argument('--height', type=int, default=800)
    parser.add_argument('--benchmark', type=int, metavar='QUADROS', help='Mede o desenho sem abrir janela.')
    args = parser.parse_args()
    if not 320 <= args.width <= 3840 or not 320 <= args.height <= 2160:
        parser.error('Largura entre 320 e 3840; altura entre 320 e 2160.')
    if args.benchmark is not None:
        if not 1 <= args.benchmark <= 1000:
            parser.error('Benchmark: use entre 1 e 1000 quadros.')
        flower = ParticleFlower()
        for i in range(3):
            flower.frame(i / 60, args.width, args.height)
        times = []
        for i in range(args.benchmark):
            start = time.perf_counter()
            flower.frame(i * CYCLE / args.benchmark, args.width, args.height)
            times.append((time.perf_counter() - start) * 1000)
        print(f'{flower.count} partículas | mediana {np.median(times):.1f} ms | p95 {np.percentile(times, 95):.1f} ms | desenho {1000 / np.median(times):.1f} FPS')
    elif args.preview:
        args.preview.parent.mkdir(parents=True, exist_ok=True)
        ParticleFlower().frame(args.time, args.width, args.height).save(args.preview)
        print(f'Prévia salva: {args.preview.resolve()}')
    else:
        launch(args.width, args.height)


if __name__ == '__main__':
    main()
