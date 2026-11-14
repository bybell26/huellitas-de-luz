# Verificación de esta entrega

- Compilación Release con SDK .NET 10.0.404: **correcta, 0 errores y 0 advertencias**.
- `tests/smoke.py`: **Demo PASS; Pey PASS**.
- Pruebas realizaron peticiones HTTP locales al backend y usaron SQLite temporal.
- Cubierto: mínimo de monto, autorización de orden, denegar generación antes del pago, reutilizar QR, simulación limitada a Demo, generación/descarga demo, no duplicar solicitud de generación, webhook con firma inválida, firma caducada, monto incorrecto, API key ID incorrecto, confirmación firmada y eventos/transacciones repetidos.
- **No probado contra pey real:** no se usaron credenciales ni se realizaron pagos/cobros.
- **No probado contra un generador real:** el adaptador HTTP requiere que el equipo implemente su contrato o lo sustituya por el SDK elegido.
- No desplegado en AWS. SQLite/disco/worker son para una instancia local, no Lambda.
- No auditoría de seguridad formal. Antes de producción: autenticación completa, controles financieros robustos, privacidad/retención, conciliación y revisión del despliegue.
