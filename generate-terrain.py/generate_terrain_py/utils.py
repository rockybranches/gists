import numpy as np
from scipy.ndimage import zoom
import struct


def generate_heightmap(width, length, scale, octaves, roughness, seed):
    """Generates a pseudo-random heightmap using interpolated random grids."""
    np.random.seed(seed)
    heightmap = np.zeros((length, width))
    amplitude, frequency, total_amplitude = 1.0, 1.0, 0.0

    for i in range(octaves):
        grid_w = max(2, int(width / (scale / frequency)))
        grid_l = max(2, int(length / (scale / frequency)))
        low_res = np.random.rand(grid_l, grid_w)
        zoom_l, zoom_w = length / grid_l, width / grid_w
        high_res = zoom(low_res, (zoom_l, zoom_w), order=3)[:length, :width]
        heightmap += high_res * amplitude
        total_amplitude += amplitude
        frequency *= 2.0
        amplitude *= roughness

    return (heightmap - heightmap.min()) / (heightmap.max() - heightmap.min())


def build_3d_mesh(heightmap, base_height):
    """Converts a 2D heightmap into a closed, 3D printable solid mesh."""
    length, width = heightmap.shape
    vertices, faces = [], []
    for y in range(length):
        for x in range(width):
            vertices.append([float(x), float(y), float(heightmap[y, x])])
    bottom_offset = len(vertices)
    for y in range(length):
        for x in range(width):
            vertices.append([float(x), float(y), -float(base_height)])

    def idx(x, y, bottom=False):
        return (y * width + x) + (bottom_offset if bottom else 0)

    for y in range(length - 1):
        for x in range(width - 1):
            faces.append([idx(x, y), idx(x, y + 1), idx(x + 1, y)])
            faces.append([idx(x + 1, y), idx(x, y + 1), idx(x + 1, y + 1)])
            faces.append([idx(x, y, True), idx(x + 1, y, True), idx(x, y + 1, True)])
            faces.append(
                [idx(x + 1, y, True), idx(x + 1, y + 1, True), idx(x, y + 1, True)]
            )

    for x in range(width - 1):
        faces.append([idx(x, 0), idx(x + 1, 0), idx(x, 0, True)])
        faces.append([idx(x + 1, 0), idx(x + 1, 0, True), idx(x, 0, True)])
        faces.append(
            [idx(x, length - 1), idx(x, length - 1, True), idx(x + 1, length - 1)]
        )
        faces.append(
            [
                idx(x + 1, length - 1),
                idx(x, length - 1, True),
                idx(x + 1, length - 1, True),
            ]
        )

    for y in range(length - 1):
        faces.append([idx(0, y), idx(0, y, True), idx(0, y + 1)])
        faces.append([idx(0, y + 1), idx(0, y, True), idx(0, y + 1, True)])
        faces.append(
            [idx(width - 1, y), idx(width - 1, y + 1), idx(width - 1, y, True)]
        )
        faces.append(
            [
                idx(width - 1, y + 1),
                idx(width - 1, y + 1, True),
                idx(width - 1, y, True),
            ]
        )

    return np.array(vertices), np.array(faces)


def write_stl(filename, vertices, faces):
    """Writes a 3D mesh out to a standard binary STL file format."""
    with open(filename, "wb") as f:
        f.write(b"\x00" * 80)
        f.write(struct.pack("<I", len(faces)))
        for face in faces:
            v1, v2, v3 = vertices[face], vertices[face], vertices[face]
            normal = np.cross(v2 - v1, v3 - v1)
            norm = np.linalg.norm(normal)
            if norm > 0:
                normal /= norm
            else:
                normal = np.array([0.0, 0.0, 0.0])
            f.write(struct.pack("<3f", *normal))
            f.write(struct.pack("<3f", *v1))
            f.write(struct.pack("<3f", *v2))
            f.write(struct.pack("<3f", *v3))
            f.write(b"\x00\x00")
