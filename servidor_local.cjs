const {createServer} = require('./pruebas-pey/server.cjs');
const server = createServer(undefined, undefined, __dirname);
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'Puerto 8000 ocupado. Cierra el servidor anterior.' : 'No se pudo iniciar el servidor.'); process.exitCode = 1; });
server.listen(8000, '127.0.0.1', () => console.log('Orbita Pets + Pey\nCreador: http://127.0.0.1:8000/index.html\nPantalla compartida: http://127.0.0.1:8000/display.html\nCtrl+C para cerrar.'));
