#!/usr/bin/env python3
"""Servidor web local sin dependencias externas para Órbita Pets."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import webbrowser

HOST = "127.0.0.1"
PORT = 8000  # Puerto fijo: permite recuperar mascotas de sesiones anteriores.
ROOT = Path(__file__).resolve().parent
handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
try:
    server = ThreadingHTTPServer((HOST, PORT), handler)
except OSError:
    print(f"El puerto {PORT} está ocupado. Cierra el otro servidor o usa Live Server en VS Code.")
    sys.exit(1)
url = f"http://{HOST}:{PORT}/index.html"
print("\nÓRBITA PETS 3.0 | CONSTELACIÓN DIGITAL")
print(f"Creador:    {url}")
print(f"Exhibición: http://{HOST}:{PORT}/display.html")
print("Mantén esta ventana abierta durante la exhibición. Ctrl+C para cerrar.\n")
try:
    webbrowser.open(url)
    server.serve_forever(poll_interval=.25)
except KeyboardInterrupt:
    print("\nServidor detenido.")
finally:
    server.server_close()
