import { randomUUID } from 'node:crypto';
import { IdGenerator } from '../../../../domain/ports/out/IdGenerator.js';

/** ADAPTADOR DE SALIDA: IDs con UUID v4 nativo de Node. */
export class UuidIdGenerator extends IdGenerator {
  generate() {
    return randomUUID();
  }
}
