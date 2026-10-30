import { ValidationError } from '../errors/DomainError.js';

/**
 * Objeto de valor: lugar donde quedó el documento.
 * Es el corazón del negocio: quien encuentra el documento no puede
 * llevárselo (farmacia, tienda...), así que deja registrada la dirección.
 */
export class Location {
  constructor(props) {
    const { placeName, address, city, reference } =
      props !== null && typeof props === 'object' ? props : {};
    const errors = [];
    if (!isNonEmpty(placeName)) errors.push('placeName: el nombre del lugar es obligatorio (ej. "Droguería La Rebaja")');
    if (!isNonEmpty(address)) errors.push('address: la dirección es obligatoria');
    if (!isNonEmpty(city)) errors.push('city: la ciudad es obligatoria');
    if (reference !== undefined && reference !== null && typeof reference !== 'string') {
      errors.push('reference: debe ser texto');
    }
    if (errors.length) {
      throw new ValidationError('La ubicación del documento no es válida', errors);
    }

    this.placeName = placeName.trim();
    this.address = address.trim();
    this.city = city.trim();
    this.reference = reference?.trim() || null;
    Object.freeze(this);
  }
}

const isNonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
