# Documentos Extraviados — Backend

API que conecta a las personas que **pierden** sus documentos con las personas que los **ven** olvidados en lugares donde no pueden tomarlos (farmacias, tiendas, etc.).

**Regla de negocio:**
1. Quien ve un documento olvidado registra **la dirección del lugar donde está**.
2. Quien perdió su documento consulta con **su número de identificación** si hay algún registro.

## Requisitos

- Node.js 20 o superior.
- La aplicación no tiene dependencias de producción; `npm install` solo instala las herramientas de pruebas.

## Cómo ejecutar

```bash
npm install                # solo la primera vez (Jest y Supertest)
npm start                  # inicia en http://localhost:3000  (PORT=4000 npm start para cambiarlo)
npm run dev                # igual, pero reinicia al guardar cambios
```

## Pruebas

Se usan **Jest** (framework de pruebas) y **Supertest** (peticiones HTTP contra el servidor sin abrir un puerto fijo).

```bash
npm test                   # todas
npm run test:unit          # solo unitarias
npm run test:integration   # solo integración
npm run test:coverage      # todas + reporte de cobertura en coverage/
```

```
tests/
├── helpers/builders.js                 Datos de prueba reutilizables, reloj e ids falsos
├── unit/domain/                        UNITARIAS: el dominio aislado
│   ├── models/                         DocumentNumber, Location, FoundDocument
│   ├── services/                       FoundDocumentService con puertos simulados (jest.fn)
│   └── ports/                          Contratos de los puertos y errores de dominio
└── integration/
    ├── domain/                         Servicio + adaptadores reales (BD en memoria, UUID, reloj)
    └── api/                            HTTP → controlador → dominio → BD (Supertest)
```

- **Unitarias:** cada puerto de salida se reemplaza por un doble (`jest.fn`), así solo se prueba la lógica del dominio y se verifica cómo usa sus puertos (qué guarda, cuándo no guarda nada, etc.).
- **Integración:** se conectan las piezas reales y se recorren los flujos completos del negocio (alguien reporta → el dueño busca → lo recupera).
- **Cobertura mínima exigida:** 95 % en `src/domain/` y 85 % global. Si baja, `npm run test:coverage` falla.

### GitHub Actions

`.github/workflows/tests.yml` se ejecuta en cada *push* a `main`/`master`/`develop`, en cada *pull request* y manualmente:

1. **Unitarias** en Node 20 y 22.
2. **Integración** en Node 20 y 22 (solo si pasan las unitarias).
3. **Cobertura**: corre todo con cobertura, publica una tabla en el resumen del workflow y sube el reporte HTML como artefacto (`coverage-report`).

Recomendado: haz `npm install` localmente y sube el `package-lock.json` al repositorio; así el workflow usa `npm ci` (instalaciones reproducibles).

La base de datos es **en memoria**: los datos se pierden al reiniciar el servidor.

## Arquitectura (hexagonal / puertos y adaptadores)

```
src/
├── domain/                         ← Núcleo. No depende de nada externo.
│   ├── models/                     Entidades y objetos de valor
│   │   ├── FoundDocument.js        Entidad: documento encontrado
│   │   ├── DocumentNumber.js       Número de documento (normalizado y validado)
│   │   ├── Location.js             Lugar donde está el documento
│   │   ├── DocumentType.js         Cédula, pasaporte, licencia...
│   │   └── DocumentStatus.js       REPORTADO | RECUPERADO
│   ├── ports/
│   │   ├── in/                     Puertos de entrada (casos de uso)
│   │   │   ├── ReportFoundDocumentUseCase.js
│   │   │   ├── SearchFoundDocumentUseCase.js
│   │   │   └── MarkDocumentRecoveredUseCase.js
│   │   └── out/                    Puertos de salida (lo que el dominio necesita)
│   │       ├── FoundDocumentRepository.js
│   │       ├── IdGenerator.js
│   │       └── Clock.js
│   ├── services/
│   │   └── FoundDocumentService.js Implementa los casos de uso
│   └── errors/
│       └── DomainError.js
│
├── infrastructure/                 ← Adaptadores concretos
│   ├── adapters/
│   │   ├── in/http/                Adaptador de entrada: API REST
│   │   │   ├── HttpServer.js       Servidor, JSON y errores → códigos HTTP
│   │   │   ├── Router.js
│   │   │   ├── FoundDocumentController.js
│   │   │   └── FoundDocumentMapper.js
│   │   └── out/                    Adaptadores de salida
│   │       ├── persistence/InMemoryFoundDocumentRepository.js
│   │       ├── id/UuidIdGenerator.js
│   │       └── time/SystemClock.js
│   └── config/
│       └── container.js            Conecta puertos con adaptadores
│
└── main.js                         Punto de entrada
```

**Dirección de las dependencias:** `infrastructure → domain`, nunca al revés.
El controlador HTTP solo conoce los puertos de entrada; el servicio solo conoce los puertos de salida. Para cambiar la BD en memoria por PostgreSQL, por ejemplo, se crea un adaptador que extienda `FoundDocumentRepository` y se cambia una línea en `container.js`; el dominio no se toca.

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/documentos` | Registrar un documento visto extraviado |
| `GET` | `/api/documentos?numero=XXXX` | Buscar por número de documento |
| `GET` | `/api/documentos/:id` | Ver un reporte |
| `PATCH` | `/api/documentos/:id/recuperado` | Marcar como recuperado (exige el número) |
| `GET` | `/health` | Estado del servicio |

### Registrar un documento

```http
POST /api/documentos
Content-Type: application/json

{
  "documentNumber": "1.020.345.678",
  "documentType": "CEDULA_CIUDADANIA",
  "holderName": "Ana Pérez",
  "location": {
    "placeName": "Droguería La Esquina",
    "address": "Calle 10 # 5-20",
    "city": "Bogotá",
    "reference": "Lo tiene la cajera"
  },
  "notes": "Estaba junto a la caja registradora"
}
```

Obligatorios: `documentNumber`, `documentType`, `location.placeName`, `location.address`, `location.city`.
`documentType`: `CEDULA_CIUDADANIA`, `TARJETA_IDENTIDAD`, `CEDULA_EXTRANJERIA`, `PASAPORTE`, `LICENCIA_CONDUCCION`, `OTRO`.

### Buscar mi documento

```http
GET /api/documentos?numero=1020345678
```

```json
{
  "found": true,
  "total": 1,
  "message": "Hay documentos registrados con ese número. Revisa la dirección para recogerlo.",
  "results": [
    {
      "id": "9546e1ef-...",
      "documentNumber": "******5678",
      "documentType": "CEDULA_CIUDADANIA",
      "location": { "placeName": "Droguería La Esquina", "address": "Calle 10 # 5-20", "city": "Bogotá", "reference": "Lo tiene la cajera" },
      "status": "REPORTADO",
      "reportedAt": "2026-10-30T15:23:29.659Z"
    }
  ]
}
```

## Decisiones de diseño

- **Normalización del número:** `1.020.345.678`, `1020 345 678` y `1020345678` son el mismo documento.
- **Privacidad:** no existe un endpoint para listar todos los documentos; solo se puede buscar conociendo el número. En las respuestas el número aparece enmascarado (últimos 4 dígitos).
- **Recuperado:** cuando el dueño recoge su documento lo marca como recuperado (enviando su número como verificación) y deja de aparecer en las búsquedas.

## Códigos de error

| Código | Cuándo |
|---|---|
| 400 | Datos inválidos o JSON mal formado |
| 404 | Ruta o reporte inexistente |
| 405 | Método no permitido en esa ruta |
| 409 | El documento ya estaba marcado como recuperado |
