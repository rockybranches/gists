#
# reqs: click numpy scipy
#
import click
import numpy as np
from scipy.ndimage import zoom
import struct


def generate_heightmap(width, length, scale, octaves, roughness, seed):
    """Generates a pseudo-random heightmap using interpolated random grids."""
    np.random.seed(seed)

    # Initialize empty heightmap
    heightmap = np.zeros((length, width))

    # Generate layered noise (fractal Brownian motion approximation)
    amplitude = 1.0
    frequency = 1.0
    total_amplitude = 0.0

    for i in range(octaves):
        # Determine the size of the low-res random grid for this octave
        grid_w = max(2, int(width / (scale / frequency)))
        grid_l = max(2, int(length / (scale / frequency)))

        # Generate random noise grid
        low_res = np.random.rand(grid_l, grid_w)

        # Zoom/interpolate up to the target heightmap resolution
        zoom_l = length / grid_l
        zoom_w = width / grid_w
        high_res = zoom(low_res, (zoom_l, zoom_w), order=3)[:length, :width]

        # Accumulate octave features
        heightmap += high_res * amplitude
        total_amplitude += amplitude

        # Update frequency and amplitude for the next octave
        frequency *= 2.0
        amplitude *= roughness

    # Normalize heightmap between 0 and 1
    heightmap = (heightmap - heightmap.min()) / (heightmap.max() - heightmap.min())
    return heightmap


def write_stl(filename, vertices, faces):
    """Writes a 3D mesh out to a standard binary STL file format."""
    with open(filename, "wb") as f:
        # Write 80-byte empty header
        f.write(b"\x00" * 80)
        # Write total number of facets (triangles)
        f.write(struct.pack("<I", len(faces)))

        for face in faces:
            # Extract vertices for the triangle
            v1, v2, v3 = vertices[face[0]], vertices[face[1]], vertices[face[2]]

            # Calculate surface normal vector using cross product
            normal = np.cross(v2 - v1, v3 - v1)
            norm = np.linalg.norm(normal)
            if norm > 0:
                normal /= norm
            else:
                normal = np.array([0.0, 0.0, 0.0])

            # Write data: 3 floats for normal, 9 for vertices, 2 bytes attribute byte count
            f.write(struct.pack("<3f", *normal))
            f.write(struct.pack("<3f", *v1))
            f.write(struct.pack("<3f", *v2))
            f.write(struct.pack("<3f", *v3))
            f.write(b"\x00\x00")


def build_3d_mesh(heightmap, base_height):
    """Converts a 2D heightmap into a closed, 3D printable solid mesh."""
    length, width = heightmap.shape
    vertices = []
    faces = []

    # 1. Generate top surface vertices
    for y in range(length):
        for x in range(width):
            vertices.append([float(x), float(y), float(heightmap[y, x])])

    # Index offset for bottom vertices
    bottom_offset = len(vertices)

    # 2. Generate corresponding base vertices (flat bottom)
    for y in range(length):
        for x in range(width):
            vertices.append([float(x), float(y), -float(base_height)])

    # Helper to get 1D index from 2D coordinate
    def idx(x, y, bottom=False):
        return (y * width + x) + (bottom_offset if bottom else 0)

    # 3. Create faces (triangles)
    for y in range(length - 1):
        for x in range(width - 1):
            # Top Surface Triangles
            faces.append([idx(x, y), idx(x, y + 1), idx(x + 1, y)])
            faces.append([idx(x + 1, y), idx(x, y + 1), idx(x + 1, y + 1)])

            # Bottom Surface Triangles (flipped winding order to point downwards)
            faces.append([idx(x, y, True), idx(x + 1, y, True), idx(x, y + 1, True)])
            faces.append(
                [idx(x + 1, y, True), idx(x + 1, y + 1, True), idx(x, y + 1, True)]
            )

    # 4. Create Side Walls (Skirts)
    for x in range(width - 1):
        # Y = 0 Wall
        faces.append([idx(x, 0), idx(x + 1, 0), idx(x, 0, True)])
        faces.append([idx(x + 1, 0), idx(x + 1, 0, True), idx(x, 0, True)])
        # Y = length - 1 Wall
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
        # X = 0 Wall
        faces.append([idx(0, y), idx(0, y, True), idx(0, y + 1)])
        faces.append([idx(0, y + 1), idx(0, y, True), idx(0, y + 1, True)])
        # X = width - 1 Wall
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


# Define CLI commands and options using Click
@click.command()
@click.option("--width", default=100, help="Width (X-axis resolution) of the terrain.")
@click.option(
    "--length", default=100, help="Length (Y-axis resolution) of the terrain."
)
@click.option("--height-scale", default=20.0, help="Multiplier for terrain peaks.")
@click.option("--base-height", default=5.0, help="Thickness of the solid base floor.")
@click.option(
    "--scale", default=50.0, help="Horizontal feature scale (larger = smoother plains)."
)
@click.option("--octaves", default=4, help="Number of noise layers for detail.")
@click.option(
    "--roughness", default=0.5, help="How much detail octaves impact the surface."
)
@click.option("--seed", default=42, help="Random seed for reproducibility.")
@click.option("--output", "-o", default="terrain.stl", help="Output STL filename.")
def main(
    width, length, height_scale, base_height, scale, octaves, roughness, seed, output
):
    """Generates a 3D printable pseudorandom terrain mesh and exports it as an STL file."""
    click.echo(f"🎨 Generating {width}x{length} heightmap texture (Seed: {seed})...")
    heightmap = generate_heightmap(width, length, scale, octaves, roughness, seed)

    # Scale heightmap up to requested peak heights
    heightmap *= height_scale

    click.echo("📐 Constructing 3D manifold mesh geometry with solid base...")
    vertices, faces = build_3d_mesh(heightmap, base_height)

    click.echo(f"💾 Saving binary STL model to '{output}' ({len(faces)} polygons)...")
    write_stl(output, vertices, faces)

    click.echo("✨ Done! Terrain successfully generated.")


if __name__ == "__main__":
    main()
