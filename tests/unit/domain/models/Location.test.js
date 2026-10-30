/**
 * PRUEBAS UNITARIAS — Location
 *
 * Location es el objeto de valor que guarda DÓNDE quedó el documento.
 * Es el centro de la regla de negocio: quien ve un documento olvidado en una
 * farmacia o tienda no puede llevárselo, así que registra el lugar.
 * Sin una ubicación completa el reporte no sirve, por eso se valida con cuidado.
 */
import { describe, test, expect } from '@jest/globals';
import { Location } from '../../../../src/domain/models/Location.js';
import { ValidationError } from '../../../../src/domain/errors/DomainError.js';
import { aLocation, catchError } from '../../../helpers/builders.js';

describe('Location (objeto de valor)', () => {
  // Caso feliz: con todos los datos se crea bien, y los espacios sobrantes
  // que suelen quedar al escribir en un formulario se eliminan.
  test('crea una ubicación válida y recorta espacios', () => {
    const location = new Location(
      aLocation({ placeName: '  Tienda D1 ', address: ' Cra 7 # 45-10 ', city: ' Medellín ' }),
    );
    // toMatchObject comprueba solo las propiedades indicadas.
    expect(location).toMatchObject({
      placeName: 'Tienda D1',
      address: 'Cra 7 # 45-10',
      city: 'Medellín',
    });
  });

  // La referencia ("lo tiene la cajera") ayuda pero no es obligatoria.
  // Si no viene, o viene en blanco, se guarda como null y no como texto vacío.
  test('la referencia es opcional y queda en null si no se envía', () => {
    expect(new Location(aLocation({ reference: undefined })).reference).toBeNull();
    expect(new Location(aLocation({ reference: '   ' })).reference).toBeNull();
  });

  // Un objeto de valor no debe poder cambiarse después de creado.
  // Location usa Object.freeze, así que asignar una propiedad lanza TypeError
  // (los módulos ES siempre se ejecutan en modo estricto).
  test('es inmutable', () => {
    const location = new Location(aLocation());
    expect(() => {
      'use strict';
      location.address = 'otra';
    }).toThrow(TypeError);
  });

  // Se repite la misma prueba para cada campo obligatorio, dejándolo vacío.
  // Además del tipo de error, se verifica que el detalle indique qué campo falló,
  // para que el cliente pueda mostrar el mensaje junto al campo correcto.
  test.each(['placeName', 'address', 'city'])('exige el campo %s', async (field) => {
    const err = await catchError(() => new Location(aLocation({ [field]: '' })));
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.details).toHaveLength(1); // solo ese campo está mal
    expect(err.details[0]).toMatch(new RegExp(`^${field}:`)); // el detalle empieza por el nombre del campo
  });

  // Si faltan varios campos se informan todos de una vez, para que el usuario
  // no tenga que corregir el formulario de a un error por intento.
  test('reporta todos los campos faltantes a la vez', async () => {
    const err = await catchError(() => new Location({}));
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.details).toHaveLength(3);
  });

  // Prueba de regresión: antes, enviar "location": null producía un TypeError
  // (error 500 en la API). Ahora cualquier valor que no sea un objeto
  // debe producir un error de validación (400).
  test.each([[undefined], [null], ['Calle 10'], [42]])(
    'con %p lanza ValidationError (no TypeError)',
    (value) => {
      expect(() => new Location(value)).toThrow(ValidationError);
    },
  );

  // La referencia, si viene, tiene que ser texto.
  test('rechaza una referencia que no sea texto', () => {
    expect(() => new Location(aLocation({ reference: 123 }))).toThrow(ValidationError);
  });
});
