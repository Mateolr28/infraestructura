import { describe, test, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { buildContainer } from '../../../src/infrastructure/config/container.js';
import { aReportCommand } from '../../helpers/builders.js';

/**
 * PRUEBAS DE INTEGRACIÓN de extremo a extremo:
 * HTTP → controlador → servicio de dominio → repositorio en memoria.
 * Supertest levanta el servidor en un puerto libre por cada petición.
 */
describe('API /api/documentos', () => {
  let server;

  beforeEach(() => {
    ({ server } = buildContainer());
  });

  const createReport = (overrides) =>
    request(server).post('/api/documentos').send(aReportCommand(overrides));

  describe('POST /api/documentos', () => {
    test('201 y el reporte creado, con el número enmascarado', async () => {
      const res = await createReport();

      expect(res.status).toBe(201);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toMatchObject({
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
      expect(typeof res.body.id).toBe('string');
      expect(new Date(res.body.reportedAt).toString()).not.toBe('Invalid Date');
    });

    test('400 con detalles si falta la ubicación', async () => {
      const res = await createReport({ location: { placeName: 'Tienda' } });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/ubicación/);
      expect(res.body.details).toHaveLength(2);
    });

    test('400 (no 500) si location viene en null', async () => {
      const res = await createReport({ location: null });
      expect(res.status).toBe(400);
    });

    test('400 si el tipo de documento no existe', async () => {
      const res = await createReport({ documentType: 'CARNET' });
      expect(res.status).toBe(400);
    });

    test('400 si el JSON está mal formado', async () => {
      const res = await request(server)
        .post('/api/documentos')
        .set('Content-Type', 'application/json')
        .send('{malo');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/JSON/);
    });

    test('413 si el cuerpo es demasiado grande', async () => {
      const res = await createReport({ notes: 'x'.repeat(200 * 1024) });
      expect(res.status).toBe(413);
    });
  });

  describe('GET /api/documentos?numero=', () => {
    test('encuentra el documento aunque el número se escriba distinto', async () => {
      await createReport();

      const res = await request(server).get('/api/documentos').query({ numero: '1.020.345.678' });

      expect(res.status).toBe(200);
      expect(res.body.found).toBe(true);
      expect(res.body.total).toBe(1);
      expect(res.body.results[0].location.address).toBe('Calle 10 # 5-20');
    });

    test('responde found=false cuando no hay registros', async () => {
      const res = await request(server).get('/api/documentos').query({ numero: '99999999' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ found: false, total: 0, results: [] });
    });

    test('400 si no se envía el número', async () => {
      const res = await request(server).get('/api/documentos');
      expect(res.status).toBe(400);
    });

    test('400 si el número es inválido', async () => {
      const res = await request(server).get('/api/documentos').query({ numero: '12' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/documentos/:id', () => {
    test('200 con el reporte', async () => {
      const { body: created } = await createReport();
      const res = await request(server).get(`/api/documentos/${created.id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(created.id);
    });

    test('404 si no existe', async () => {
      const res = await request(server).get('/api/documentos/no-existe');
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/documentos/:id/recuperado', () => {
    test('marca como recuperado y deja de aparecer en búsquedas', async () => {
      const { body: created } = await createReport();

      const res = await request(server)
        .patch(`/api/documentos/${created.id}/recuperado`)
        .send({ documentNumber: '1020345678' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('RECUPERADO');
      expect(res.body.recoveredAt).not.toBeNull();

      const search = await request(server).get('/api/documentos').query({ numero: '1020345678' });
      expect(search.body.found).toBe(false);
    });

    test('409 si ya estaba recuperado', async () => {
      const { body: created } = await createReport();
      const url = `/api/documentos/${created.id}/recuperado`;
      await request(server).patch(url).send({ documentNumber: '1020345678' });

      const res = await request(server).patch(url).send({ documentNumber: '1020345678' });
      expect(res.status).toBe(409);
    });

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
    test('GET /health responde ok', async () => {
      const res = await request(server).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });

    test('404 en rutas desconocidas', async () => {
      const res = await request(server).get('/otra-ruta');
      expect(res.status).toBe(404);
    });

    test('405 en métodos no soportados', async () => {
      const res = await request(server).delete('/api/documentos');
      expect(res.status).toBe(405);
    });

    test('OPTIONS responde 204 con cabeceras CORS', async () => {
      const res = await request(server).options('/api/documentos');
      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe('*');
    });
  });
});
