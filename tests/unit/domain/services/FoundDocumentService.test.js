/**
 * PRUEBAS UNITARIAS — FoundDocumentService
 *
 * El servicio implementa los casos de uso del negocio:
 *  - report()                  → registrar un documento encontrado
 *  - searchByDocumentNumber()  → buscar con mi número de documento
 *  - getById()                 → ver un reporte
 *  - markAsRecovered()         → marcar que ya lo recogí
 *
 * Al ser pruebas UNITARIAS, todos los puertos de salida (repositorio,
 * generador de ids y reloj) se reemplazan por dobles creados con jest.fn().
 * Así se prueba SOLO la lógica del servicio, sin base de datos real, y se puede
 * verificar exactamente cómo usa sus puertos (qué guarda, cuántas veces, etc.).
 *
 * Las pruebas siguen el patrón Preparar → Ejecutar → Comprobar
 * (en inglés Arrange → Act → Assert).
 */
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

// Fecha fija que devolverá el reloj simulado.
const NOW = new Date('2026-10-30T10:00:00.000Z');

/**
 * Crea un documento ya existente, como si viniera del repositorio.
 * Se usa para configurar lo que devuelven los métodos simulados.
 */
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

  // Antes de CADA prueba se crean dobles nuevos, para que ninguna prueba
  // se vea afectada por las llamadas registradas en otra.
  beforeEach(() => {
    // Repositorio simulado: por defecto no encuentra nada.
    repository = {
      save: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn().mockResolvedValue(null),
      findByDocumentNumber: jest.fn().mockResolvedValue([]),
    };
    // Generador de ids simulado: siempre devuelve 'doc-1'.
    idGenerator = { generate: jest.fn().mockReturnValue('doc-1') };
    // Reloj simulado: siempre devuelve NOW.
    clock = { now: jest.fn().mockReturnValue(NOW) };

    // Se inyectan los dobles en el servicio (inyección de dependencias).
    service = new FoundDocumentService({ repository, idGenerator, clock });
  });

  describe('report() — registrar documento encontrado', () => {
    // El servicio debe pedir el id y la fecha a los puertos (no inventarlos él)
    // y armar un documento válido en estado REPORTADO.
    test('crea el documento con el id y la fecha que dan los puertos', async () => {
      // Ejecutar
      const doc = await service.report(aReportCommand());

      // Comprobar: se consultó cada puerto una sola vez...
      expect(idGenerator.generate).toHaveBeenCalledTimes(1);
      expect(clock.now).toHaveBeenCalledTimes(1);
      // ...y el documento creado tiene los datos correctos.
      expect(doc).toBeInstanceOf(FoundDocument);
      expect(doc.id).toBe('doc-1');
      expect(doc.reportedAt).toEqual(NOW);
      expect(doc.status).toBe(DocumentStatus.REPORTADO);
      expect(doc.documentNumber.value).toBe('1020345678');
      expect(doc.location.address).toBe('Calle 10 # 5-20');
    });

    // El reporte debe quedar guardado: se verifica que se llamó a save()
    // una vez y con el mismo documento que se devolvió.
    test('guarda el documento en el repositorio exactamente una vez', async () => {
      const doc = await service.report(aReportCommand());
      expect(repository.save).toHaveBeenCalledTimes(1);
      expect(repository.save).toHaveBeenCalledWith(doc);
    });

    // holderName y notes pueden omitirse; deben quedar en null.
    test('los campos opcionales quedan en null', async () => {
      const doc = await service.report(aReportCommand({ holderName: undefined, notes: undefined }));
      expect(doc.holderName).toBeNull();
      expect(doc.notes).toBeNull();
    });

    // Muy importante: si los datos son inválidos, el servicio debe fallar
    // ANTES de tocar el repositorio, para no guardar reportes incompletos.
    test('si los datos son inválidos no guarda nada', async () => {
      // Sin ubicación
      await expect(service.report(aReportCommand({ location: null }))).rejects.toThrow(
        ValidationError,
      );
      // Con un tipo de documento que no existe
      await expect(service.report(aReportCommand({ documentType: 'X' }))).rejects.toThrow(
        ValidationError,
      );
      // Sin ningún dato
      await expect(service.report()).rejects.toThrow(ValidationError);

      // En ningún caso se llamó a save()
      expect(repository.save).not.toHaveBeenCalled();
    });

    // Si la base de datos falla, el error no debe ocultarse.
    test('propaga los errores del repositorio', async () => {
      // Preparar: el repositorio simulado falla al guardar
      repository.save.mockRejectedValue(new Error('BD caída'));
      // Ejecutar y comprobar
      await expect(service.report(aReportCommand())).rejects.toThrow('BD caída');
    });
  });

  describe('searchByDocumentNumber() — verificar si hay documentos con mi número', () => {
    // El servicio normaliza el número antes de buscar, así el repositorio
    // siempre recibe un DocumentNumber limpio sin importar cómo lo escribió el usuario.
    test('consulta el repositorio con el número normalizado', async () => {
      await service.searchByDocumentNumber('1.020.345.678');

      expect(repository.findByDocumentNumber).toHaveBeenCalledTimes(1);
      // mock.calls[0] contiene los argumentos de la primera llamada
      const [arg] = repository.findByDocumentNumber.mock.calls[0];
      expect(arg).toBeInstanceOf(DocumentNumber);
      expect(arg.value).toBe('1020345678');
    });

    // Si nadie ha reportado el documento, se devuelve una lista vacía (no un error).
    test('devuelve lista vacía cuando no hay registros', async () => {
      await expect(service.searchByDocumentNumber('1020345678')).resolves.toEqual([]);
    });

    // Los documentos que el dueño ya recogió no deben mostrarse,
    // para no mandar a nadie a buscar algo que ya no está.
    test('excluye los documentos ya recuperados', async () => {
      // Preparar: el repositorio devuelve uno disponible y uno recuperado
      const available = existingDocument({ id: 'a' });
      const recovered = existingDocument({ id: 'b', status: DocumentStatus.RECUPERADO });
      repository.findByDocumentNumber.mockResolvedValue([available, recovered]);

      // Ejecutar
      const results = await service.searchByDocumentNumber('1020345678');

      // Comprobar: solo queda el disponible
      expect(results.map((d) => d.id)).toEqual(['a']);
    });

    // Si hay varios reportes del mismo documento, el más reciente es el más
    // probable de seguir en el lugar, por eso va primero.
    test('ordena del más reciente al más antiguo', async () => {
      // Preparar: el repositorio los devuelve desordenados a propósito
      repository.findByDocumentNumber.mockResolvedValue([
        existingDocument({ id: 'viejo', reportedAt: new Date('2026-10-01') }),
        existingDocument({ id: 'nuevo', reportedAt: new Date('2026-10-29') }),
        existingDocument({ id: 'medio', reportedAt: new Date('2026-10-15') }),
      ]);

      const results = await service.searchByDocumentNumber('1020345678');

      expect(results.map((d) => d.id)).toEqual(['nuevo', 'medio', 'viejo']);
    });

    // Un número inválido se rechaza sin consultar el repositorio (no tiene sentido buscarlo).
    test('rechaza un número inválido sin consultar el repositorio', async () => {
      await expect(service.searchByDocumentNumber('12')).rejects.toThrow(ValidationError);
      await expect(service.searchByDocumentNumber(undefined)).rejects.toThrow(ValidationError);
      expect(repository.findByDocumentNumber).not.toHaveBeenCalled();
    });
  });

  describe('getById()', () => {
    // Si el reporte existe, se devuelve tal cual lo entrega el repositorio.
    test('devuelve el documento si existe', async () => {
      const doc = existingDocument();
      repository.findById.mockResolvedValue(doc);

      await expect(service.getById('doc-1')).resolves.toBe(doc);
      expect(repository.findById).toHaveBeenCalledWith('doc-1');
    });

    // Si no existe, se lanza un error de dominio específico
    // (la API lo traduce a 404).
    test('lanza NotFoundError si no existe', async () => {
      await expect(service.getById('no-existe')).rejects.toThrow(NotFoundError);
    });
  });

  describe('markAsRecovered()', () => {
    // Caso feliz: el número coincide, se marca como recuperado con la hora
    // del reloj y el cambio se guarda en el repositorio.
    test('marca el documento como recuperado con la hora del reloj y lo guarda', async () => {
      // Preparar
      const later = new Date('2026-10-31T09:00:00.000Z');
      clock.now.mockReturnValue(later);
      repository.findById.mockResolvedValue(existingDocument());

      // Ejecutar (el número se envía con puntos: también se normaliza aquí)
      const doc = await service.markAsRecovered('doc-1', '1.020.345.678');

      // Comprobar
      expect(doc.status).toBe(DocumentStatus.RECUPERADO);
      expect(doc.recoveredAt).toEqual(later);
      expect(repository.save).toHaveBeenCalledWith(doc);
    });

    // Medida de seguridad: para cerrar un reporte hay que conocer el número
    // del documento. Así nadie puede marcar como recuperados reportes ajenos.
    test('exige que el número coincida con el del reporte', async () => {
      repository.findById.mockResolvedValue(existingDocument());

      await expect(service.markAsRecovered('doc-1', '99999999')).rejects.toThrow(
        'no coincide',
      );
      expect(repository.save).not.toHaveBeenCalled();
    });

    // Sin número no se puede verificar al dueño.
    test('exige el número de documento', async () => {
      repository.findById.mockResolvedValue(existingDocument());
      await expect(service.markAsRecovered('doc-1', undefined)).rejects.toThrow(ValidationError);
    });

    // No se puede recuperar un reporte que no existe.
    test('lanza NotFoundError si el reporte no existe', async () => {
      await expect(service.markAsRecovered('nope', '1020345678')).rejects.toThrow(NotFoundError);
      expect(repository.save).not.toHaveBeenCalled();
    });

    // Un reporte ya recuperado no puede recuperarse de nuevo
    // (la API lo traduce a 409 Conflict).
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
