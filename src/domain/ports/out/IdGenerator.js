/**
 * PUERTO DE SALIDA: generación de identificadores únicos.
 * Se abstrae para que el dominio no dependa de una librería concreta
 * y para poder usar IDs predecibles en las pruebas.
 */
export class IdGenerator {
  /** @returns {string} */
  generate() {
    throw new Error('IdGenerator.generate() no implementado');
  }
}
