# Compatibilidad con el inicio anterior: el servidor de pagos requiere Node.js.
from pathlib import Path
import subprocess
import sys

try:
    sys.exit(subprocess.call(["node", str(Path(__file__).with_suffix(".cjs"))]))
except FileNotFoundError:
    print("Instala Node.js 22 o superior y ejecuta iniciar_windows.bat.")
    sys.exit(1)
