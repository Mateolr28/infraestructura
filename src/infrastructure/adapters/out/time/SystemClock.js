import { Clock } from '../../../../domain/ports/out/Clock.js';

/** ADAPTADOR DE SALIDA: reloj del sistema. */
export class SystemClock extends Clock {
  now() {
    return new Date();
  }
}
