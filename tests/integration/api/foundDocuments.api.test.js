/**
 * PRUEBAS DE INTEGRACIÓN — API HTTP de extremo a extremo
 *
 * Recorren la aplicación completa, tal como la usaría un cliente real:
 *   petición HTTP → controlador → servicio de dominio → repositorio en memoria
 *
 * Se usa Supertest: recibe el servidor de Node, lo levanta en un puerto libre
 * para cada petición y lo cierra al terminar. Así no hace falta ejecutar
 * "npm start" ni reservar un puerto fijo.
 *
 * Además del caso feliz de cada endpoint, se verifica que cada error del
 * dominio se traduzca al código HTTP correcto (400, 404, 405, 409, 413).
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { buildContainer } from '../../../src/infrastructure/config/container.js';
import { aReportCommand } from '../../helpers/builders.js';

describe('API /api/documentos', () => {
  let server;

  // Antes de cada prueba se arma la aplicación completa con buildContainer(),
  // el mismo que usa main.js. Así cada prueba empieza con la base de datos vacía.
  beforeEach(() => {
    ({ server } = buildContainer());
  });

  // Atajo: registra un documento por la API (POST) con datos válidos por defecto.
  const createReport = (overrides) =>
    request(server).post('/api/documentos').send(aReportCommand(overrides));

  describe('POST /api/documentos', () => {
    // Caso feliz: se crea el reporte y se responde 201 (Created) con sus datos.
    test('201 y el reporte creado, con el número enmascarado', async () => {
      const res = await createReport();

      expect(res.status).toBe(201);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toMatchObject({
        // Por privacidad la API solo muestra los últimos 4 dígitos
        documentNumber: '******5678',
        documentType: 'CEDULA_CIUDADANIA',
        holderName: 'Ana Pérez',
        status: 'REPORTADO',
        recoveredAt: null,
        location: {
          placeName: 'Droguería La Esquina',
          address: 'Calle 10 # 5-20',
          city: 'Bogotá',
          reference: 'Lo tiene la cajera',
        },
      });
      // El id lo genera el servidor
      expect(typeof res.body.id).toBe('string');
      // La fecha viene en un formato que se puede convertir a Date
      expect(new Date(res.body.reportedAt).toString()).not.toBe('Invalid Date');
    });

    // Una ubicación incompleta se responde con 400 (Bad Request) y la lista
    // de campos que faltan, para que el cliente pueda mostrarlos.
    test('400 con detalles si falta la ubicación', async () => {
      const res = await createReport({ location: { placeName: 'Tienda' } }); // faltan address y city
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/ubicación/);
      expect(res.body.details).toHaveLength(2);
    });

    // Prueba de regresión: antes este caso respondía 500 (error interno).
    test('400 (no 500) si location viene en null', async () => {
      const res = await createReport({ location: null });
      expect(res.status).toBe(400);
    });

    test('400 si el tipo de documento no existe', async () => {
      const res = await createReport({ documentType: 'CARNET' });
      expect(res.status).toBe(400);
    });

    // Si el cuerpo no es JSON válido, el servidor debe responder 400
    // con un mensaje claro, no caerse.
    test('400 si el JSON está mal formado', async () => {
      const res = await request(server)
        .post('/api/documentos')
        .set('Content-Type', 'application/json')
        .send('{malo'); // texto que no es JSON válido
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/JSON/);
    });

    // Protección contra abusos: un cuerpo de más de 100 KB se rechaza con
    // 413 (Payload Too Large). Prueba de regresión: antes el servidor cortaba
    // la conexión sin responder.
    test('413 si el cuerpo es demasiado grande', async () => {
      const res = await createReport({ notes: 'x'.repeat(200 * 1024) }); // ~200 KB
      expect(res.status).toBe(413);
    });
  });

  describe('GET /api/documentos?numero=', () => {
    // La búsqueda principal del negocio: el dueño escribe su número
    // (aquí con puntos) y recibe la dirección donde está su documento.
    test('encuentra el documento aunque el número se escriba distinto', async () => {
      await createReport(); // alguien lo reportó antes

      // .query() agrega ?numero=1.020.345.678 a la URL
      const res = await request(server).get('/api/documentos').query({ numero: '1.020.345.678' });

      expect(res.status).toBe(200);
      expect(res.body.found).toBe(true);
      expect(res.body.total).toBe(1);
      expect(res.body.results[0].location.address).toBe('Calle 10 # 5-20');
    });

    // No encontrar nada no es un error: se responde 200 con found=false.
    test('responde found=false cuando no hay registros', async () => {
      const res = await request(server).get('/api/documentos').query({ numero: '99999999' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ found: false, total: 0, results: [] });
    });

    // El parámetro "numero" es obligatorio: no se permite listar todos
    // los documentos (eso expondría datos personales).
    test('400 si no se envía el número', async () => {
      const res = await request(server).get('/api/documentos');
      expect(res.status).toBe(400);
    });

    test('400 si el número es inválido', async () => {
      const res = await request(server).get('/api/documentos').query({ numero: '12' }); // muy corto
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/documentos/:id', () => {
    // Se crea un reporte y luego se consulta por el id que devolvió la API.
    test('200 con el reporte', async () => {
      const { body: created } = await createReport();
      const res = await request(server).get(`/api/documentos/${created.id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(created.id);
    });

    // NotFoundError del dominio → 404 Not Found.
    test('404 si no existe', async () => {
      const res = await request(server).get('/api/documentos/no-existe');
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/documentos/:id/recuperado', () => {
    // El dueño confirma que recogió su documento: el reporte cambia de estado
    // y deja de aparecer en las búsquedas.
    test('marca como recuperado y deja de aparecer en búsquedas', async () => {
      const { body: created } = await createReport();

      const res = await request(server)
        .patch(`/api/documentos/${created.id}/recuperado`)
        .send({ documentNumber: '1020345678' }); // número completo como verificación

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('RECUPERADO');
      expect(res.body.recoveredAt).not.toBeNull();

      // Al buscar de nuevo ya no aparece
      const search = await request(server).get('/api/documentos').query({ numero: '1020345678' });
      expect(search.body.found).toBe(false);
    });

    // InvalidStateError del dominio → 409 Conflict.
    test('409 si ya estaba recuperado', async () => {
      const { body: created } = await createReport();
      const url = `/api/documentos/${created.id}/recuperado`;
      await request(server).patch(url).send({ documentNumber: '1020345678' }); // primera vez: OK

      const res = await request(server).patch(url).send({ documentNumber: '1020345678' }); // segunda vez
      expect(res.status).toBe(409);
    });

    // Sin el número correcto no se puede cerrar el reporte.
    test('400 si el número no coincide', async () => {
      const { body: created } = await createReport();
      const res = await request(server)
        .patch(`/api/documentos/${created.id}/recuperado`)
        .send({ documentNumber: '11111111' });
      expect(res.status).toBe(400);
    });

    test('404 si el reporte no existe', async () => {
      const res = await request(server)
        .patch('/api/documentos/nope/recuperado')
        .send({ documentNumber: '1020345678' });
      expect(res.status).toBe(404);
    });
  });

  describe('rutas generales', () => {
    // Endpoint de salud, útil para monitoreo o para saber si el servidor está arriba.
    test('GET /health responde ok', async () => {
      const res = await request(server).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });

    // Una ruta que no existe → 404.
    test('404 en rutas desconocidas', async () => {
      const res = await request(server).get('/otra-ruta');
      expect(res.status).toBe(404);
    });

    // La ruta existe pero no admite ese método (DELETE) → 405 Method Not Allowed.
    test('405 en métodos no soportados', async () => {
      const res = await request(server).delete('/api/documentos');
      expect(res.status).toBe(405);
    });

    // Los navegadores envían una petición OPTIONS antes de llamar a la API desde
    // otro dominio (CORS). Debe responderse 204 con las cabeceras que lo permiten,
    // para que un futuro frontend pueda consumir este backend.
    test('OPTIONS responde 204 con cabeceras CORS', async () => {
      const res = await request(server).options('/api/documentos');
      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe('*');
    });
  });
});
