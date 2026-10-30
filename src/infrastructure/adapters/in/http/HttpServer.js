import http from 'node:http';
import { Router } from './Router.js';
import {
  ValidationError,
  NotFoundError,
  InvalidStateError,
  DomainError,
} from '../../../../domain/errors/DomainError.js';

const MAX_BODY_BYTES = 100 * 1024;

/**
 * ADAPTADOR DE ENTRADA: servidor HTTP con el módulo nativo de Node.
 * Define las rutas, parsea JSON y traduce errores del dominio a códigos HTTP.
 */
export const createHttpServer = ({ foundDocumentController: c }) => {
  const router = new Router()
    .get('/health', async () => ({ status: 200, body: { status: 'ok' } }))
    .post('/api/documentos', c.report)
    .get('/api/documentos', c.search)
    .get('/api/documentos/:id', c.getById)
    .patch('/api/documentos/:id/recuperado', c.markAsRecovered);

  return http.createServer(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') return send(res, 204);

    const url = new URL(req.url, 'http://localhost');
    const match = router.match(req.method, url.pathname);

    if (!match) return send(res, 404, { error: 'Ruta no encontrada' });
    if (match.methodNotAllowed) return send(res, 405, { error: 'Método no permitido' });

    try {
      const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readJson(req) : undefined;
      const result = await match.handler({ params: match.params, query: url.searchParams, body });
      send(res, result.status, result.body);
    } catch (err) {
      const { status, payload } = mapError(err);
      if (status === 500) console.error(err);
      send(res, status, payload);
    }
  });
};

class BadRequestError extends Error {}
class PayloadTooLargeError extends Error {}

const readJson = (req) =>
  new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    req.on('data', (chunk) => {
      if (tooLarge) return; // se descarta el resto sin cortar la conexión
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        chunks.length = 0;
        reject(new PayloadTooLargeError('El cuerpo de la petición es demasiado grande'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) return;
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new BadRequestError('El cuerpo debe ser JSON válido'));
      }
    });
    req.on('error', reject);
  });

const mapError = (err) => {
  if (err instanceof ValidationError) {
    return { status: 400, payload: { error: err.message, details: err.details } };
  }
  if (err instanceof NotFoundError) return { status: 404, payload: { error: err.message } };
  if (err instanceof InvalidStateError) return { status: 409, payload: { error: err.message } };
  if (err instanceof DomainError) return { status: 422, payload: { error: err.message } };
  if (err instanceof BadRequestError) return { status: 400, payload: { error: err.message } };
  if (err instanceof PayloadTooLargeError) return { status: 413, payload: { error: err.message } };
  return { status: 500, payload: { error: 'Error interno del servidor' } };
};

const setCors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

const send = (res, status, body) => {
  if (body === undefined) {
    res.writeHead(status);
    return res.end();
  }
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
};
