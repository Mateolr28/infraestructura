/**
 * PRUEBAS DE INTEGRACIÓN — Dominio + adaptadores de salida reales
 *
 * A diferencia de las pruebas unitarias, aquí NO se simulan los puertos:
 * el servicio de dominio trabaja contra los adaptadores reales de la
 * infraestructura (base de datos en memoria, generador UUID y reloj del sistema).
 * El objetivo es comprobar que todas las piezas encajan entre sí y que los
 * flujos completos del negocio funcionan de principio a fin.
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { FoundDocumentService } from '../../../src/domain/services/FoundDocumentService.js';
import { DocumentStatus } from '../../../src/domain/models/DocumentStatus.js';
import { DocumentNumber } from '../../../src/domain/models/DocumentNumber.js';
import { FoundDocumentRepository } from '../../../src/domain/ports/out/FoundDocumentRepository.js';
import { IdGenerator } from '../../../src/domain/ports/out/IdGenerator.js';
import { Clock } from '../../../src/domain/ports/out/Clock.js';
import { InMemoryFoundDocumentRepository } from '../../../src/infrastructure/adapters/out/persistence/InMemoryFoundDocumentRepository.js';
import { UuidIdGenerator } from '../../../src/infrastructure/adapters/out/id/UuidIdGenerator.js';
import { SystemClock } from '../../../src/infrastructure/adapters/out/time/SystemClock.js';
import { InvalidStateError } from '../../../src/domain/errors/DomainError.js';
import { aReportCommand, aLocation, fakeClock, sequentialIds } from '../../helpers/builders.js';

// Formato de un UUID versión 4 (8-4-4-4-12 caracteres hexadecimales, con un 4 fijo).
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('Dominio + adaptadores reales', () => {
  // Primer grupo: TODOS los adaptadores son los de producción.
  describe('con UUID y reloj del sistema', () => {
    let service;

    // Cada prueba arranca con una base de datos vacía.
    beforeEach(() => {
      service = new FoundDocumentService({
        repository: new InMemoryFoundDocumentRepository(),
        idGenerator: new UuidIdGenerator(),
        clock: new SystemClock(),
      });
    });

    // Cada adaptador debe extender el puerto que implementa;
    // así se garantiza que respeta el contrato del dominio.
    test('los adaptadores cumplen los puertos del dominio', () => {
      expect(new InMemoryFoundDocumentRepository()).toBeInstanceOf(FoundDocumentRepository);
      expect(new UuidIdGenerator()).toBeInstanceOf(IdGenerator);
      expect(new SystemClock()).toBeInstanceOf(Clock);
    });

    // Con los adaptadores reales, cada reporte recibe un UUID distinto
    // y una fecha dentro del intervalo en que se ejecutó la prueba.
    test('registra con un UUID v4 único y la fecha actual', async () => {
      const before = Date.now();
      const a = await service.report(aReportCommand());
      const b = await service.report(aReportCommand());
      const after = Date.now();

      expect(a.id).toMatch(UUID_REGEX);
      expect(b.id).not.toBe(a.id); // dos reportes nunca comparten id
      expect(a.reportedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(a.reportedAt.getTime()).toBeLessThanOrEqual(after);
    });

    // Prueba del escenario principal del negocio, paso a paso.
    test('flujo completo: alguien lo reporta, el dueño lo busca y lo recupera', async () => {
      // 1. Una persona ve la cédula olvidada en la droguería y la registra
      const reported = await service.report(aReportCommand());

      // 2. La dueña busca con su número escrito de otra forma (con espacios)
      const results = await service.searchByDocumentNumber('1020 345 678');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(reported.id);
      // La información clave que recibe es la dirección donde está el documento
      expect(results[0].location).toMatchObject({
        placeName: 'Droguería La Esquina',
        address: 'Calle 10 # 5-20',
        city: 'Bogotá',
      });

      // 3. La dueña lo recoge y lo marca como recuperado
      await service.markAsRecovered(reported.id, '1020345678');

      // 4. Ya no aparece en búsquedas, pero el reporte sigue existiendo (historial)
      await expect(service.searchByDocumentNumber('1020345678')).resolves.toEqual([]);
      const stored = await service.getById(reported.id);
      expect(stored.status).toBe(DocumentStatus.RECUPERADO);
      expect(stored.recoveredAt).toBeInstanceOf(Date);

      // 5. No se puede recuperar otra vez
      await expect(service.markAsRecovered(reported.id, '1020345678')).rejects.toThrow(
        InvalidStateError,
      );
    });
  });

  // Segundo grupo: repositorio real, pero reloj e ids controlados,
  // para poder comprobar órdenes y valores exactos.
  describe('con reloj e ids controlados', () => {
    let service, clock, repository;

    beforeEach(() => {
      clock = fakeClock();
      repository = new InMemoryFoundDocumentRepository();
      service = new FoundDocumentService({ repository, idGenerator: sequentialIds(), clock });
    });

    // Dos personas distintas pueden ver el mismo documento en lugares distintos
    // (o el documento cambió de sitio). Ambos reportes deben aparecer,
    // el más reciente primero.
    test('el mismo documento reportado en varios lugares aparece varias veces, el más reciente primero', async () => {
      await service.report(aReportCommand()); // doc-1, en la droguería
      clock.advance(60 * 60 * 1000); // pasa una hora
      await service.report(
        aReportCommand({ location: aLocation({ placeName: 'Tienda D1', address: 'Cra 7 # 45-10' }) }),
      ); // doc-2, en la tienda

      const results = await service.searchByDocumentNumber('1020345678');

      expect(results.map((d) => d.id)).toEqual(['doc-2', 'doc-1']);
      expect(results[0].location.placeName).toBe('Tienda D1');
    });

    // Cada persona solo debe ver los documentos que coinciden con SU número.
    test('documentos de distintas personas no se mezclan', async () => {
      await service.report(aReportCommand({ documentNumber: '11111111' }));
      await service.report(aReportCommand({ documentNumber: '22222222' }));
      await service.report(aReportCommand({ documentNumber: 'AB123456', documentType: 'PASAPORTE' }));

      expect(await service.searchByDocumentNumber('11111111')).toHaveLength(1);
      // Pasaporte buscado en minúsculas y con guiones: también lo encuentra
      expect(await service.searchByDocumentNumber('ab-123-456')).toHaveLength(1);
      // Un número que nadie reportó
      expect(await service.searchByDocumentNumber('33333333')).toHaveLength(0);
    });

    // Recuperar un reporte solo cierra ESE reporte; los demás del mismo
    // número siguen visibles.
    test('recuperar un reporte no afecta a otros reportes del mismo número', async () => {
      const first = await service.report(aReportCommand());
      await service.report(aReportCommand({ location: aLocation({ placeName: 'Otra tienda' }) }));

      await service.markAsRecovered(first.id, '1020345678');

      const results = await service.searchByDocumentNumber('1020345678');
      expect(results.map((d) => d.id)).toEqual(['doc-2']);
    });
  });

  // Tercer grupo: comportamiento específico del adaptador de base de datos en memoria.
  describe('InMemoryFoundDocumentRepository', () => {
    let repository, service;

    beforeEach(() => {
      repository = new InMemoryFoundDocumentRepository();
      service = new FoundDocumentService({
        repository,
        idGenerator: sequentialIds(),
        clock: fakeClock(),
      });
    });

    // El repositorio guarda copias, igual que una base de datos real.
    // Modificar un objeto en memoria sin llamar a save() NO debe cambiar lo guardado.
    test('las entidades devueltas son copias: modificarlas no altera lo guardado', async () => {
      const doc = await service.report(aReportCommand());
      doc.status = 'MANIPULADO'; // cambio directo sobre el objeto devuelto

      const fromSearch = (await service.searchByDocumentNumber('1020345678'))[0];
      fromSearch.holderName = 'Otro'; // cambio sobre un resultado de búsqueda

      // Lo guardado sigue intacto
      const fresh = await repository.findById(doc.id);
      expect(fresh.status).toBe(DocumentStatus.REPORTADO);
      expect(fresh.holderName).toBe('Ana Pérez');
    });

    // Al leer, el repositorio debe devolver una entidad completa y funcional
    // (con objetos de valor, fechas reales y sus métodos), no un objeto plano.
    test('reconstruye la entidad completa con sus objetos de valor y fechas', async () => {
      const doc = await service.report(aReportCommand());
      const fresh = await repository.findById(doc.id);

      expect(fresh.documentNumber.equals(doc.documentNumber)).toBe(true);
      expect(fresh.reportedAt).toEqual(doc.reportedAt);
      expect(fresh.location).toEqual(doc.location);
      expect(typeof fresh.markAsRecovered).toBe('function'); // conserva su comportamiento
    });

    // save() con un id ya existente debe actualizar, no crear un duplicado.
    test('guardar dos veces el mismo id actualiza en lugar de duplicar', async () => {
      const doc = await service.report(aReportCommand()); // primer save
      await service.markAsRecovered(doc.id, '1020345678'); // segundo save, mismo id

      const all = await repository.findByDocumentNumber(new DocumentNumber('1020345678'));
      expect(all).toHaveLength(1);
      expect(all[0].status).toBe(DocumentStatus.RECUPERADO);
    });

    // Con la base de datos vacía, las consultas devuelven "nada" sin lanzar errores.
    test('findById devuelve null y la búsqueda lista vacía cuando no hay datos', async () => {
      await expect(repository.findById('x')).resolves.toBeNull();
      await expect(repository.findByDocumentNumber(new DocumentNumber('12345678'))).resolves.toEqual(
        [],
      );
    });

    // clear() es una utilidad para pruebas que borra todos los datos.
    test('clear() vacía la base de datos', async () => {
      const doc = await service.report(aReportCommand());
      repository.clear();
      await expect(repository.findById(doc.id)).resolves.toBeNull();
    });
  });
});
