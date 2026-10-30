/**
 * PRUEBAS UNITARIAS — DocumentNumber
 *
 * DocumentNumber es un objeto de valor: representa el número de identificación
 * del documento. Es la pieza clave de la regla de negocio, porque es lo que usa
 * la persona que perdió su documento para buscarlo. Por eso se prueba a fondo:
 *  - que distintas formas de escribir el mismo número se consideren iguales,
 *  - que se rechacen valores inválidos,
 *  - y cómo se comparan dos números entre sí.
 */
import { describe, test, expect } from '@jest/globals';
import { DocumentNumber } from '../../../../src/domain/models/DocumentNumber.js';
import { ValidationError } from '../../../../src/domain/errors/DomainError.js';

describe('DocumentNumber (objeto de valor)', () => {
  describe('normalización', () => {
    // test.each ejecuta la misma prueba con cada fila de la tabla:
    // [lo que escribe el usuario, cómo debe quedar guardado].
    // Así, quien reporta y quien busca pueden escribir el número a su manera.
    test.each([
      ['1.020.345.678', '1020345678'], // con puntos de miles
      ['1020 345 678', '1020345678'], // con espacios
      ['1020-345-678', '1020345678'], // con guiones
      ['  52123456  ', '52123456'], // con espacios al inicio y al final
      ['ab123456', 'AB123456'], // pasaporte en minúsculas → mayúsculas
      ['Pe 12.34-56', 'PE123456'], // todo mezclado
    ])('"%s" se normaliza a "%s"', (raw, expected) => {
      expect(new DocumentNumber(raw).value).toBe(expected);
    });

    // Un cliente podría enviar el número como tipo number en el JSON.
    test('acepta números (no solo texto)', () => {
      expect(new DocumentNumber(52123456).value).toBe('52123456');
    });

    // Convertirlo a texto debe dar el valor ya normalizado.
    test('toString devuelve el valor normalizado', () => {
      expect(String(new DocumentNumber('1.234.567'))).toBe('1234567');
    });
  });

  describe('validación', () => {
    // Valores que no son un número de documento: deben rechazarse
    // con un error de dominio (ValidationError), no con un error genérico.
    test.each([
      [undefined], // no se envió
      [null], // se envió vacío explícitamente
      [{}], // un objeto en lugar de texto
      [''], // texto vacío
      ['   '], // solo espacios (tras normalizar queda vacío)
    ])('rechaza valores vacíos o no textuales: %p', (raw) => {
      expect(() => new DocumentNumber(raw)).toThrow(ValidationError);
    });

    // Solo se permiten letras A-Z y dígitos; cualquier otro símbolo es un error.
    // Se verifica además que el mensaje explique el motivo.
    test.each([['12$45678'], ['1234#5678'], ['ñ1234567'], ['1234/5678']])(
      'rechaza caracteres especiales: "%s"',
      (raw) => {
        expect(() => new DocumentNumber(raw)).toThrow('solo puede contener letras y números');
      },
    );

    // Límite inferior: 3 caracteres es demasiado corto (mínimo 4).
    test('rechaza números con menos del mínimo de caracteres', () => {
      expect(() => new DocumentNumber('123')).toThrow(ValidationError);
    });

    // Límite superior: 21 caracteres es demasiado largo (máximo 20).
    test('rechaza números con más del máximo de caracteres', () => {
      expect(() => new DocumentNumber('1'.repeat(21))).toThrow(ValidationError);
    });

    // Prueba de valores frontera: justo en el mínimo y justo en el máximo
    // deben aceptarse (evita errores de "menor que" vs "menor o igual que").
    test('acepta exactamente los límites mínimo y máximo', () => {
      expect(new DocumentNumber('1234').value).toHaveLength(DocumentNumber.MIN_LENGTH);
      expect(new DocumentNumber('1'.repeat(20)).value).toHaveLength(DocumentNumber.MAX_LENGTH);
    });
  });

  describe('igualdad', () => {
    // Dos objetos de valor son iguales si representan el mismo valor,
    // sin importar cómo se escribieron originalmente.
    test('dos números escritos distinto pero equivalentes son iguales', () => {
      expect(new DocumentNumber('1.020.345.678').equals(new DocumentNumber('1020345678'))).toBe(true);
    });

    test('números distintos no son iguales', () => {
      expect(new DocumentNumber('11111111').equals(new DocumentNumber('22222222'))).toBe(false);
    });

    // equals() solo compara contra otro DocumentNumber, no contra texto suelto,
    // para evitar comparar por accidente valores sin normalizar.
    test('no es igual a un string con el mismo valor', () => {
      expect(new DocumentNumber('11111111').equals('11111111')).toBe(false);
    });
  });
});
