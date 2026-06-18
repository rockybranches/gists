import sys
from PyQt6.QtWidgets import (
    QApplication,
    QMainWindow,
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QSlider,
    QLineEdit,
    QPushButton,
    QFileDialog,
    QMessageBox,
)
from PyQt6.QtCore import Qt

# Import modular generation hooks
from generate_terrain_py.utils import generate_heightmap, build_3d_mesh, write_stl


class TerrainGeneratorApp(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("3D Terrain Generator")
        self.setMinimumWidth(450)

        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_layout = QVBoxLayout(central_widget)

        # Interactive Option Sliders
        self.scale_layout, self.scale_slider = self.create_slider(
            "Horizontal Scale:", 10, 100, 50
        )
        self.height_layout, self.height_slider = self.create_slider(
            "Height Intensity:", 5, 100, 20
        )
        self.octaves_layout, self.octaves_slider = self.create_slider(
            "Noise Octaves (Detail):", 1, 8, 4
        )

        main_layout.addLayout(self.scale_layout)
        main_layout.addLayout(self.height_layout)
        main_layout.addLayout(self.octaves_layout)

        # Seed Settings Line Input
        seed_layout = QHBoxLayout()
        seed_layout.addWidget(QLabel("Random Seed Matrix:"))
        self.seed_input = QLineEdit("42")
        seed_layout.addWidget(self.seed_input)
        main_layout.addLayout(seed_layout)

        # Export Command Button
        self.export_btn = QPushButton("Generate & Save STL Mesh...")
        self.export_btn.setStyleSheet("font-weight: bold; padding: 6px;")
        self.export_btn.clicked.connect(self.handle_generation)
        main_layout.addWidget(self.export_btn)

    def create_slider(self, text, min_v, max_v, default_v):
        layout = QHBoxLayout()
        label = QLabel(f"{text} {default_v}")
        slider = QSlider(Qt.Orientation.Horizontal)
        slider.setRange(min_v, max_v)
        slider.setValue(default_v)

        # Dynamic value text update loop
        slider.valueChanged.connect(lambda val: label.setText(f"{text} {val}"))

        layout.addWidget(label)
        layout.addWidget(slider)
        return layout, slider

    def handle_generation(self):
        try:
            seed = int(self.seed_input.text())
        except ValueError:
            QMessageBox.critical(
                self, "Validation Error", "Seed value must be a valid integer."
            )
            return

        scale = float(self.scale_slider.value())
        height_scale = float(self.height_slider.value())
        octaves = int(self.octaves_slider.value())

        # Request native location file dialog frame paths
        file_path, _ = QFileDialog.getSaveFileName(
            self, "Export STL Model", "terrain.stl", "STL Meshes (*.stl)"
        )
        if not file_path:
            return

        try:
            # Generate mesh dimensions matching parameters
            heightmap = generate_heightmap(100, 100, scale, octaves, 0.5, seed)
            heightmap *= height_scale
            vertices, faces = build_3d_mesh(heightmap, 5.0)
            write_stl(file_path, vertices, faces)

            QMessageBox.information(
                self, "Success", f"3D Mesh successfully saved to:\n{file_path}"
            )
        except Exception as e:
            QMessageBox.critical(
                self, "Engine Failure", f"Processing runtime error occurred:\n{str(e)}"
            )


def main():
    app = QApplication(sys.argv)
    window = TerrainGeneratorApp()
    window.show()
    sys.argv = app.exec()


if __name__ == "__main__":
    main()
