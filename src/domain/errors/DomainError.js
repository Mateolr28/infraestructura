/**
 * Errores propios del dominio. No saben nada de HTTP;
 * es la infraestructura la que decide cómo traducirlos.
 */
export class DomainError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

/** Los datos recibidos no cumplen las reglas del dominio. */
export class ValidationError extends DomainError {
  constructor(message, details = []) {
    super(message);
    this.details = details;
  }
}

/** El recurso solicitado no existe. */
export class NotFoundError extends DomainError {}

/** La operación no es válida para el estado actual del recurso. */
export class InvalidStateError extends DomainError {}
