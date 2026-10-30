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

/**
 * PRUEBAS DE INTEGRACIÓN del dominio con los adaptadores de salida reales:
 * el servicio trabaja contra la BD en memoria, el generador UUID y el reloj
 * del sistema, verificando que todas las piezas encajan.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('Dominio + adaptadores reales', () => {
  describe('con UUID y reloj del sistema', () => {
    let service;

    beforeEach(() => {
      service = new FoundDocumentService({
        repository: new InMemoryFoundDocumentRepository(),
        idGenerator: new UuidIdGenerator(),
        clock: new SystemClock(),
      });
    });

    test('los adaptadores cumplen los puertos del dominio', () => {
      expect(new InMemoryFoundDocumentRepository()).toBeInstanceOf(FoundDocumentRepository);
      expect(new UuidIdGenerator()).toBeInstanceOf(IdGenerator);
      expect(new SystemClock()).toBeInstanceOf(Clock);
    });

    test('registra con un UUID v4 único y la fecha actual', async () => {
      const before = Date.now();
      const a = await service.report(aReportCommand());
      const b = await service.report(aReportCommand());
      const after = Date.now();

      expect(a.id).toMatch(UUID_REGEX);
      expect(b.id).not.toBe(a.id);
      expect(a.reportedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(a.reportedAt.getTime()).toBeLessThanOrEqual(after);
    });

    test('flujo completo: alguien lo reporta, el dueño lo busca y lo recupera', async () => {
      // 1. Una persona ve la cédula olvidada en la droguería y la registra
      const reported = await service.report(aReportCommand());

      // 2. La dueña busca con su número escrito de otra forma
      const results = await service.searchByDocumentNumber('1020 345 678');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(reported.id);
      expect(results[0].location).toMatchObject({
        placeName: 'Droguería La Esquina',
        address: 'Calle 10 # 5-20',
        city: 'Bogotá',
      });

      // 3. La recoge y lo marca como recuperado
      await service.markAsRecovered(reported.id, '1020345678');

      // 4. Ya no aparece en búsquedas, pero el reporte sigue existiendo
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

  describe('con reloj e ids controlados', () => {
    let service, clock, repository;

    beforeEach(() => {
      clock = fakeClock();
      repository = new InMemoryFoundDocumentRepository();
      service = new FoundDocumentService({ repository, idGenerator: sequentialIds(), clock });
    });

    test('el mismo documento reportado en varios lugares aparece varias veces, el más reciente primero', async () => {
      await service.report(aReportCommand());
      clock.advance(60 * 60 * 1000);
      await service.report(
        aReportCommand({ location: aLocation({ placeName: 'Tienda D1', address: 'Cra 7 # 45-10' }) }),
      );

      const results = await service.searchByDocumentNumber('1020345678');
      expect(results.map((d) => d.id)).toEqual(['doc-2', 'doc-1']);
      expect(results[0].location.placeName).toBe('Tienda D1');
    });

    test('documentos de distintas personas no se mezclan', async () => {
      await service.report(aReportCommand({ documentNumber: '11111111' }));
      await service.report(aReportCommand({ documentNumber: '22222222' }));
      await service.report(aReportCommand({ documentNumber: 'AB123456', documentType: 'PASAPORTE' }));

      expect(await service.searchByDocumentNumber('11111111')).toHaveLength(1);
      expect(await service.searchByDocumentNumber('ab-123-456')).toHaveLength(1);
      expect(await service.searchByDocumentNumber('33333333')).toHaveLength(0);
    });

    test('recuperar un reporte no afecta a otros reportes del mismo número', async () => {
      const first = await service.report(aReportCommand());
      await service.report(aReportCommand({ location: aLocation({ placeName: 'Otra tienda' }) }));

      await service.markAsRecovered(first.id, '1020345678');

      const results = await service.searchByDocumentNumber('1020345678');
      expect(results.map((d) => d.id)).toEqual(['doc-2']);
    });
  });

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

    test('las entidades devueltas son copias: modificarlas no altera lo guardado', async () => {
      const doc = await service.report(aReportCommand());
      doc.status = 'MANIPULADO';

      const fromSearch = (await service.searchByDocumentNumber('1020345678'))[0];
      fromSearch.holderName = 'Otro';

      const fresh = await repository.findById(doc.id);
      expect(fresh.status).toBe(DocumentStatus.REPORTADO);
      expect(fresh.holderName).toBe('Ana Pérez');
    });

    test('reconstruye la entidad completa con sus objetos de valor y fechas', async () => {
      const doc = await service.report(aReportCommand());
      const fresh = await repository.findById(doc.id);

      expect(fresh.documentNumber.equals(doc.documentNumber)).toBe(true);
      expect(fresh.reportedAt).toEqual(doc.reportedAt);
      expect(fresh.location).toEqual(doc.location);
      expect(typeof fresh.markAsRecovered).toBe('function');
    });

    test('guardar dos veces el mismo id actualiza en lugar de duplicar', async () => {
      const doc = await service.report(aReportCommand());
      await service.markAsRecovered(doc.id, '1020345678');

      const all = await repository.findByDocumentNumber(new DocumentNumber('1020345678'));
      expect(all).toHaveLength(1);
      expect(all[0].status).toBe(DocumentStatus.RECUPERADO);
    });

    test('findById devuelve null y la búsqueda lista vacía cuando no hay datos', async () => {
      await expect(repository.findById('x')).resolves.toBeNull();
      await expect(repository.findByDocumentNumber(new DocumentNumber('12345678'))).resolves.toEqual(
        [],
      );
    });

    test('clear() vacía la base de datos', async () => {
      const doc = await service.report(aReportCommand());
      repository.clear();
      await expect(repository.findById(doc.id)).resolves.toBeNull();
    });
  });
});
