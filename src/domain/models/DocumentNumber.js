import { ValidationError } from '../errors/DomainError.js';

/**
 * Objeto de valor: número de identificación del documento.
 *
 * Se normaliza para que "1.020.345.678", "1020 345 678" y "1020345678"
 * se consideren el mismo número: se eliminan espacios, puntos y guiones
 * y se pasa a mayúsculas (los pasaportes pueden tener letras).
 */
export class DocumentNumber {
  static MIN_LENGTH = 4;
  static MAX_LENGTH = 20;

  #value;

  constructor(raw) {
    if (typeof raw !== 'string' && typeof raw !== 'number') {
      throw new ValidationError('El número de documento es obligatorio');
    }
    const normalized = DocumentNumber.normalize(String(raw));

    if (!/^[A-Z0-9]+$/.test(normalized)) {
      throw new ValidationError(
        'El número de documento solo puede contener letras y números',
      );
    }
    if (
      normalized.length < DocumentNumber.MIN_LENGTH ||
      normalized.length > DocumentNumber.MAX_LENGTH
    ) {
      throw new ValidationError(
        `El número de documento debe tener entre ${DocumentNumber.MIN_LENGTH} y ${DocumentNumber.MAX_LENGTH} caracteres`,
      );
    }
    this.#value = normalized;
  }

  static normalize(raw) {
    return raw.replace(/[\s.\-]/g, '').toUpperCase();
  }

  get value() {
    return this.#value;
  }

  equals(other) {
    return other instanceof DocumentNumber && other.value === this.#value;
  }

  toString() {
    return this.#value;
  }
}
