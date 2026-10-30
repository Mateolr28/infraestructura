/**
 * PRUEBAS UNITARIAS — FoundDocument
 *
 * FoundDocument es la entidad principal del dominio: un documento que alguien
 * vio extraviado y registró. Estas pruebas verifican:
 *  - cómo se crea un reporte nuevo (FoundDocument.report),
 *  - las validaciones de sus datos,
 *  - y su ciclo de vida: REPORTADO → RECUPERADO.
 */
import { describe, test, expect } from '@jest/globals';
import { FoundDocument } from '../../../../src/domain/models/FoundDocument.js';
import { DocumentNumber } from '../../../../src/domain/models/DocumentNumber.js';
import { Location } from '../../../../src/domain/models/Location.js';
import { DocumentStatus } from '../../../../src/domain/models/DocumentStatus.js';
import { DocumentType, isValidDocumentType } from '../../../../src/domain/models/DocumentType.js';
import { ValidationError, InvalidStateError } from '../../../../src/domain/errors/DomainError.js';
import { aLocation } from '../../../helpers/builders.js';

// Fecha fija para que las pruebas sean deterministas (no dependen de la hora real).
const NOW = new Date('2026-10-30T10:00:00.000Z');

/**
 * Atajo para crear un reporte válido. Cada prueba sobrescribe
 * únicamente el dato que quiere poner a prueba.
 */
const reportDocument = (overrides = {}) =>
  FoundDocument.report({
    id: 'doc-1',
    documentNumber: '1.020.345.678',
    documentType: DocumentType.CEDULA_CIUDADANIA,
    holderName: 'Ana Pérez',
    location: aLocation(),
    notes: null,
    now: NOW,
    ...overrides,
  });

describe('FoundDocument (entidad)', () => {
  describe('FoundDocument.report()', () => {
    // Un reporte recién creado siempre empieza en estado REPORTADO,
    // con la fecha recibida y sin fecha de recuperación.
    test('crea un reporte en estado REPORTADO con la fecha indicada', () => {
      const doc = reportDocument();
      expect(doc.id).toBe('doc-1');
      expect(doc.status).toBe(DocumentStatus.REPORTADO);
      expect(doc.reportedAt).toEqual(NOW);
      expect(doc.recoveredAt).toBeNull();
      expect(doc.isAvailable()).toBe(true); // disponible = el dueño aún puede recogerlo
    });

    // La entidad recibe datos simples (texto, objetos planos) y los convierte
    // en objetos de valor, que ya traen su validación y normalización.
    test('convierte los datos primitivos en objetos de valor', () => {
      const doc = reportDocument();
      expect(doc.documentNumber).toBeInstanceOf(DocumentNumber);
      expect(doc.documentNumber.value).toBe('1020345678'); // ya normalizado
      expect(doc.location).toBeInstanceOf(Location);
    });

    // Si ya llegan como objetos de valor, se reutilizan tal cual (misma instancia,
    // por eso se usa toBe y no toEqual). Esto pasa al reconstruir desde la BD.
    test('acepta objetos de valor ya construidos', () => {
      const number = new DocumentNumber('52123456');
      const location = new Location(aLocation());
      const doc = reportDocument({ documentNumber: number, location });
      expect(doc.documentNumber).toBe(number);
      expect(doc.location).toBe(location);
    });

    // El nombre del titular y las notas no son obligatorios:
    // si no vienen quedan en null, y si vienen se les quitan los espacios sobrantes.
    test('holderName y notes son opcionales y se recortan', () => {
      expect(reportDocument({ holderName: undefined, notes: undefined })).toMatchObject({
        holderName: null,
        notes: null,
      });
      expect(reportDocument({ holderName: '  Ana  ', notes: ' nota ' })).toMatchObject({
        holderName: 'Ana',
        notes: 'nota',
      });
    });

    // Si no se indica la fecha, la entidad usa la fecha actual.
    test('usa la fecha actual si no se indica una', () => {
      const doc = reportDocument({ now: undefined });
      expect(doc.reportedAt).toBeInstanceOf(Date);
    });
  });

  describe('validaciones', () => {
    // Toda entidad necesita un identificador para poder consultarla después.
    test('exige un id', () => {
      expect(() => reportDocument({ id: undefined })).toThrow(ValidationError);
    });

    // Tipos que no están en el catálogo deben rechazarse.
    // Ojo con 'cedula_ciudadania': el catálogo distingue mayúsculas y minúsculas.
    test.each([['CARNET'], [''], [undefined], ['cedula_ciudadania']])(
      'rechaza el tipo de documento %p',
      (documentType) => {
        expect(() => reportDocument({ documentType })).toThrow('documentType inválido');
      },
    );

    // Y al revés: todos los tipos del catálogo deben aceptarse.
    // Object.values(DocumentType) genera una prueba por cada tipo existente,
    // así, si se agrega un tipo nuevo, queda probado automáticamente.
    test.each(Object.values(DocumentType))('acepta el tipo de documento %s', (documentType) => {
      expect(reportDocument({ documentType }).documentType).toBe(documentType);
    });

    // Los campos opcionales, si vienen, deben ser texto.
    test('rechaza holderName o notes que no sean texto', () => {
      expect(() => reportDocument({ holderName: 123 })).toThrow(ValidationError);
      expect(() => reportDocument({ notes: ['x'] })).toThrow(ValidationError);
    });

    // Los errores de los objetos de valor (número o ubicación inválidos)
    // deben llegar hasta quien crea la entidad, sin ocultarse.
    test('propaga los errores del número y la ubicación', () => {
      expect(() => reportDocument({ documentNumber: '12' })).toThrow(ValidationError);
      expect(() => reportDocument({ location: { city: 'Cali' } })).toThrow(ValidationError);
    });
  });

  describe('markAsRecovered()', () => {
    // Cuando el dueño recoge su documento, el reporte pasa a RECUPERADO,
    // guarda la fecha y deja de estar disponible (ya no aparece en búsquedas).
    test('cambia el estado a RECUPERADO y guarda la fecha', () => {
      const doc = reportDocument();
      const later = new Date('2026-10-31T08:00:00.000Z');

      doc.markAsRecovered(later);

      expect(doc.status).toBe(DocumentStatus.RECUPERADO);
      expect(doc.recoveredAt).toEqual(later);
      expect(doc.isAvailable()).toBe(false);
    });

    // Regla de estado: un documento ya recuperado no puede recuperarse otra vez.
    test('no se puede recuperar dos veces', () => {
      const doc = reportDocument();
      doc.markAsRecovered(NOW);
      expect(() => doc.markAsRecovered(NOW)).toThrow(InvalidStateError);
    });
  });
});

describe('DocumentType', () => {
  // Función auxiliar que usa la entidad para validar el tipo.
  test('isValidDocumentType reconoce los valores del catálogo', () => {
    expect(isValidDocumentType('PASAPORTE')).toBe(true);
    expect(isValidDocumentType('CARNET')).toBe(false);
  });

  // Los catálogos están congelados: nadie puede agregar o cambiar valores
  // en tiempo de ejecución por accidente.
  test('el catálogo no se puede modificar', () => {
    expect(Object.isFrozen(DocumentType)).toBe(true);
    expect(Object.isFrozen(DocumentStatus)).toBe(true);
  });
});
