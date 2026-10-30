import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { FoundDocumentService } from '../../../../src/domain/services/FoundDocumentService.js';
import { FoundDocument } from '../../../../src/domain/models/FoundDocument.js';
import { DocumentNumber } from '../../../../src/domain/models/DocumentNumber.js';
import { DocumentStatus } from '../../../../src/domain/models/DocumentStatus.js';
import {
  ValidationError,
  NotFoundError,
  InvalidStateError,
} from '../../../../src/domain/errors/DomainError.js';
import { aReportCommand, aLocation } from '../../../helpers/builders.js';

/**
 * PRUEBAS UNITARIAS del servicio de dominio.
 * Todos los puertos de salida se reemplazan por dobles (jest.fn),
 * así se prueba solo la lógica del servicio, aislada de cualquier adaptador.
 */

const NOW = new Date('2026-10-30T10:00:00.000Z');

const existingDocument = (overrides = {}) =>
  new FoundDocument({
    id: 'doc-1',
    documentNumber: '1020345678',
    documentType: 'CEDULA_CIUDADANIA',
    location: aLocation(),
    reportedAt: NOW,
    ...overrides,
  });

describe('FoundDocumentService (unitarias, puertos simulados)', () => {
  let repository, idGenerator, clock, service;

  beforeEach(() => {
    repository = {
      save: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn().mockResolvedValue(null),
      findByDocumentNumber: jest.fn().mockResolvedValue([]),
    };
    idGenerator = { generate: jest.fn().mockReturnValue('doc-1') };
    clock = { now: jest.fn().mockReturnValue(NOW) };
    service = new FoundDocumentService({ repository, idGenerator, clock });
  });

  describe('report() — registrar documento encontrado', () => {
    test('crea el documento con el id y la fecha que dan los puertos', async () => {
      const doc = await service.report(aReportCommand());

      expect(idGenerator.generate).toHaveBeenCalledTimes(1);
      expect(clock.now).toHaveBeenCalledTimes(1);
      expect(doc).toBeInstanceOf(FoundDocument);
      expect(doc.id).toBe('doc-1');
      expect(doc.reportedAt).toEqual(NOW);
      expect(doc.status).toBe(DocumentStatus.REPORTADO);
      expect(doc.documentNumber.value).toBe('1020345678');
      expect(doc.location.address).toBe('Calle 10 # 5-20');
    });

    test('guarda el documento en el repositorio exactamente una vez', async () => {
      const doc = await service.report(aReportCommand());
      expect(repository.save).toHaveBeenCalledTimes(1);
      expect(repository.save).toHaveBeenCalledWith(doc);
    });

    test('los campos opcionales quedan en null', async () => {
      const doc = await service.report(aReportCommand({ holderName: undefined, notes: undefined }));
      expect(doc.holderName).toBeNull();
      expect(doc.notes).toBeNull();
    });

    test('si los datos son inválidos no guarda nada', async () => {
      await expect(service.report(aReportCommand({ location: null }))).rejects.toThrow(
        ValidationError,
      );
      await expect(service.report(aReportCommand({ documentType: 'X' }))).rejects.toThrow(
        ValidationError,
      );
      await expect(service.report()).rejects.toThrow(ValidationError);
      expect(repository.save).not.toHaveBeenCalled();
    });

    test('propaga los errores del repositorio', async () => {
      repository.save.mockRejectedValue(new Error('BD caída'));
      await expect(service.report(aReportCommand())).rejects.toThrow('BD caída');
    });
  });

  describe('searchByDocumentNumber() — verificar si hay documentos con mi número', () => {
    test('consulta el repositorio con el número normalizado', async () => {
      await service.searchByDocumentNumber('1.020.345.678');

      expect(repository.findByDocumentNumber).toHaveBeenCalledTimes(1);
      const [arg] = repository.findByDocumentNumber.mock.calls[0];
      expect(arg).toBeInstanceOf(DocumentNumber);
      expect(arg.value).toBe('1020345678');
    });

    test('devuelve lista vacía cuando no hay registros', async () => {
      await expect(service.searchByDocumentNumber('1020345678')).resolves.toEqual([]);
    });

    test('excluye los documentos ya recuperados', async () => {
      const available = existingDocument({ id: 'a' });
      const recovered = existingDocument({ id: 'b', status: DocumentStatus.RECUPERADO });
      repository.findByDocumentNumber.mockResolvedValue([available, recovered]);

      const results = await service.searchByDocumentNumber('1020345678');
      expect(results.map((d) => d.id)).toEqual(['a']);
    });

    test('ordena del más reciente al más antiguo', async () => {
      repository.findByDocumentNumber.mockResolvedValue([
        existingDocument({ id: 'viejo', reportedAt: new Date('2026-10-01') }),
        existingDocument({ id: 'nuevo', reportedAt: new Date('2026-10-29') }),
        existingDocument({ id: 'medio', reportedAt: new Date('2026-10-15') }),
      ]);

      const results = await service.searchByDocumentNumber('1020345678');
      expect(results.map((d) => d.id)).toEqual(['nuevo', 'medio', 'viejo']);
    });

    test('rechaza un número inválido sin consultar el repositorio', async () => {
      await expect(service.searchByDocumentNumber('12')).rejects.toThrow(ValidationError);
      await expect(service.searchByDocumentNumber(undefined)).rejects.toThrow(ValidationError);
      expect(repository.findByDocumentNumber).not.toHaveBeenCalled();
    });
  });

  describe('getById()', () => {
    test('devuelve el documento si existe', async () => {
      const doc = existingDocument();
      repository.findById.mockResolvedValue(doc);

      await expect(service.getById('doc-1')).resolves.toBe(doc);
      expect(repository.findById).toHaveBeenCalledWith('doc-1');
    });

    test('lanza NotFoundError si no existe', async () => {
      await expect(service.getById('no-existe')).rejects.toThrow(NotFoundError);
    });
  });

  describe('markAsRecovered()', () => {
    test('marca el documento como recuperado con la hora del reloj y lo guarda', async () => {
      const later = new Date('2026-10-31T09:00:00.000Z');
      clock.now.mockReturnValue(later);
      repository.findById.mockResolvedValue(existingDocument());

      const doc = await service.markAsRecovered('doc-1', '1.020.345.678');

      expect(doc.status).toBe(DocumentStatus.RECUPERADO);
      expect(doc.recoveredAt).toEqual(later);
      expect(repository.save).toHaveBeenCalledWith(doc);
    });

    test('exige que el número coincida con el del reporte', async () => {
      repository.findById.mockResolvedValue(existingDocument());

      await expect(service.markAsRecovered('doc-1', '99999999')).rejects.toThrow(
        'no coincide',
      );
      expect(repository.save).not.toHaveBeenCalled();
    });

    test('exige el número de documento', async () => {
      repository.findById.mockResolvedValue(existingDocument());
      await expect(service.markAsRecovered('doc-1', undefined)).rejects.toThrow(ValidationError);
    });

    test('lanza NotFoundError si el reporte no existe', async () => {
      await expect(service.markAsRecovered('nope', '1020345678')).rejects.toThrow(NotFoundError);
      expect(repository.save).not.toHaveBeenCalled();
    });

    test('lanza InvalidStateError si ya estaba recuperado', async () => {
      repository.findById.mockResolvedValue(
        existingDocument({ status: DocumentStatus.RECUPERADO, recoveredAt: NOW }),
      );
      await expect(service.markAsRecovered('doc-1', '1020345678')).rejects.toThrow(
        InvalidStateError,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });
  });
});
