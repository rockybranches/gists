import click
import numpy as np
from scipy.ndimage import zoom
import struct
import shutil  # Used to get current terminal size
import time
import os
import webbrowser
import http.server
import socketserver
import threading


def serve_web_plot(heightmap, address="0.0.0.0", port=8090):
    """Generates an interactive 3D Plotly graph, saves it, and hosts it locally."""
    import plotly.graph_objects as go

    click.echo("🌐 Generating interactive 3D HTML visualization...")

    # 1. Create a 3D Surface map using Plotly with the Earth color palette
    fig = go.Figure(data=[go.Surface(z=heightmap, colorscale="Earth")])

    fig.update_layout(
        title="Interactive 3D Terrain Map",
        autosize=True,
        margin=dict(l=0, r=0, b=0, t=40),
        scene=dict(
            xaxis_title="X Axis",
            yaxis_title="Y Axis",
            zaxis_title="Elevation",
            aspectratio=dict(
                x=1, y=1, z=0.4
            ),  # Slightly flatten Z for better terrain aesthetics
        ),
    )

    # Save the output temporarily as an HTML bundle file
    output_html = "index.html"
    fig.write_html(output_html)

    # 2. Setup a custom HTTP request handler to suppress heavy server print outputs
    class QuietHandler(http.server.SimpleHTTPRequestHandler):
        def log_message(self, format, *args):
            pass  # Keep terminal logging clean

    # 3. Create a clean shutdown function for the server thread
    def run_server():
        socketserver.TCPServer.allow_reuse_address = True
        with socketserver.TCPServer((f"{address}", port), QuietHandler) as httpd:
            click.echo(f"🚀 Local server live at http://{address}:{port}/")
            click.echo("Press Ctrl+C in the terminal to exit and shutdown the server.")
            httpd.serve_forever()

    # Launch server in a separate background daemon thread
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()

    # Give the server half a second to initialize, then launch your native web browser automatically
    time.sleep(0.5)
    webbrowser.open(f"http://{address}:{port}/")

    # Keep main thread alive until user explicitly hits Ctrl+C to terminate
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        click.echo("\n🛑 Server stopped successfully.")


def interactive_viewer(heightmap):
    """Starts a real-time, interactive wireframe rotation loop in the terminal."""
    # Downsample heightmap to 40x40 to ensure fast, lag-free terminal rendering
    h_l, h_w = heightmap.shape
    disp_l, disp_w = 40, 40
    grid = zoom(heightmap, (disp_l / h_l, disp_w / h_w), order=1)

    # Starting angles for 3D rotation (in radians)
    angle_x = 0.6  # Tilt up/down
    angle_z = 0.7  # Spin left/right

    click.echo("\n🎮 Entering Interactive Mode...")
    click.echo("Controls: W/S (Tilt up/down) | A/D (Rotate left/right) | Q (Quit)")
    click.echo("Press Enter after typing a command...")
    time.sleep(2)

    while True:
        term_cols, term_lines = shutil.get_terminal_size((80, 24))
        cx, cy = term_cols // 2, term_lines // 2

        # Initialize an empty terminal screen buffer
        screen = {(x, y): " " for x in range(term_cols) for y in range(term_lines)}

        # Precompute trigonometric rotation values
        cos_x, sin_x = np.cos(angle_x), np.sin(angle_x)
        cos_z, sin_z = np.cos(angle_z), np.sin(angle_z)

        # Project 3D points down to 2D screen coordinates
        for y in range(disp_l):
            for x in range(disp_w):
                # Center coordinates around the 0,0 origin
                x0, y0 = x - disp_w / 2, y - disp_l / 2
                z0 = (grid[y, x] - 0.5) * 15.0  # Scale height visual intensity

                # Apply 3D Rotation matrices (Z-axis then X-axis)
                x1 = x0 * cos_z - y0 * sin_z
                y1 = x0 * sin_z + y0 * cos_z

                y2 = y1 * cos_x - z0 * sin_x
                z2 = y1 * sin_x + z0 * cos_x

                # Orthographic projection to terminal screen space
                # Multiplying X by 2 accounts for narrow terminal character spacing
                screen_x = int(cx + x1 * 2.0)
                screen_y = int(cy + y2)

                # Pick character shading density based on original landscape depth
                chars = " .:-=+*#%@@"
                char_idx = int(np.clip(grid[y, x], 0.0, 0.99) * len(chars))

                if 0 <= screen_x < term_cols and 0 <= screen_y < term_lines:
                    screen[(screen_x, screen_y)] = chars[char_idx]

        # Render the text frame onto the display
        output_buffer = []
        for y in range(term_lines - 1):
            row_str = "".join(screen[(x, y)] for x in range(term_cols))
            output_buffer.append(row_str)

        os.system("cls" if os.name == "nt" else "clear")
        print("\n".join(output_buffer), end="")

        # Get standard non-blocking keyboard input loop
        user_input = click.prompt("", default=" ", show_default=False).lower()

        if "q" in user_input:
            break
        elif "a" in user_input:
            angle_z -= 0.15  # Spin Counter-Clockwise
        elif "d" in user_input:
            angle_z += 0.15  # Spin Clockwise
        elif "w" in user_input:
            angle_x += 0.15  # Tilt Forward
        elif "s" in user_input:
            angle_x -= 0.15  # Tilt Backward


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


def render_terminal_ascii(heightmap):
    """Resizes the heightmap to fit the terminal window and prints it as ASCII art."""
    # 1. Get the current size of the user's terminal window
    term_cols, term_lines = shutil.get_terminal_size((80, 24))

    # Reserve a few terminal rows for text prompts/CLI padding
    max_display_w = term_cols - 2
    max_display_l = term_lines - 5

    # 2. Downsample the grid using Scipy so it fits perfectly in the terminal screen
    # Terminal characters are twice as tall as they are wide, so we stretch width scale by 2.0
    h_l, h_w = heightmap.shape
    scale_l = max_display_l / h_l
    scale_w = max_display_w / h_w
    final_scale = min(scale_l, scale_w * 0.5)

    # Ensure it's scaled down safely
    disp_l = max(2, int(h_l * final_scale))
    disp_w = max(2, int(h_w * final_scale * 2.0))

    ascii_grid = zoom(heightmap, (disp_l / h_l, disp_w / h_w), order=1)

    # 3. Define an ASCII gradient from lowest (valleys) to highest (peaks)
    # Dense/Bright characters represent mountain peaks, small dots represent low ground
    chars = " .:-=+*#%@@"
    num_chars = len(chars)

    click.echo("\n--- Terminal Terrain Preview ---")
    for row in ascii_grid:
        line_chars = []
        for val in row:
            # Map height values (0.0 to 1.0) to an index in our char string
            char_idx = int(np.clip(val, 0.0, 0.99) * num_chars)
            line_chars.append(chars[char_idx])
        click.echo("".join(line_chars))
    click.echo("-" * disp_w + "\n")


def write_stl(filename, vertices, faces):
    """Writes a 3D mesh out to a standard binary STL file format."""
    with open(filename, "wb") as f:
        f.write(b"\x00" * 80)
        f.write(struct.pack("<I", len(faces)))
        for face in faces:
            v1, v2, v3 = vertices[face[0]], vertices[face[1]], vertices[face[2]]
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


def build_3d_mesh(heightmap, base_height):
    """Converts a 2D heightmap into a closed, 3D printable solid mesh."""
    length, width = heightmap.shape
    vertices = []
    faces = []

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


@click.command()
@click.option("--width", default=100, help="Width (X-axis resolution) of the terrain.")
@click.option(
    "--length", default=100, help="Length (Y-axis resolution) of the terrain."
)
@click.option("--height-scale", default=20.0, help="Multiplier for terrain peaks.")
@click.option("--base-height", default=5.0, help="Thickness of the solid base floor.")
@click.option("--scale", default=50.0, help="Horizontal feature scale.")
@click.option("--octaves", default=4, help="Number of noise layers for detail.")
@click.option(
    "--roughness", default=0.5, help="How much detail octaves impact the surface."
)
@click.option("--seed", default=42, help="Random seed for reproducibility.")
@click.option("--output", "-o", default="terrain.stl", help="Output STL filename.")
@click.option(
    "--visualize",
    "-v",
    is_flag=True,
    help="Render an ASCII visualization map in the terminal.",
)
@click.option(
    "--interactive",
    "-i",
    is_flag=True,
    help="Launch real-time rotating 3D window inside terminal.",
)
@click.option(
    "--serve",
    "-s",
    is_flag=True,
    help="Launch a local web server to display an interactive 3D HTML plot.",
)
@click.option(
    "--export",
    "-e",
    is_flag=True,
    help="Save the output to FILENAME (STL).",
)
def main(
    width,
    length,
    height_scale,
    base_height,
    scale,
    octaves,
    roughness,
    seed,
    output,
    visualize,
    interactive,
    serve,
    export,
):
    """Generates a 3D printable pseudorandom terrain mesh and exports it as an STL file."""
    click.echo(f"🎨 Generating {width}x{length} heightmap texture (Seed: {seed})...")
    heightmap = generate_heightmap(width, length, scale, octaves, roughness, seed)

    # Render preview inside terminal if user requested it
    if visualize:
        render_terminal_ascii(heightmap)

    # Launch interactive 3d plot in terminal
    if interactive:
        interactive_viewer(heightmap)

    # Serve interactive Web UI 3D plot
    if serve:
        serve_web_plot(heightmap)

    if not export:
        exit(0)

    click.secho("Building, Exporting STL...")
    # Scale heightmap up to requested peak heights for 3D modeling
    heightmap *= height_scale

    click.echo("📐 Constructing 3D manifold mesh geometry with solid base...")
    vertices, faces = build_3d_mesh(heightmap, base_height)

    click.echo(f"💾 Saving binary STL model to '{output}' ({len(faces)} polygons)...")
    write_stl(output, vertices, faces)

    click.echo("✨ Done! Terrain successfully generated.")


if __name__ == "__main__":
    main()
