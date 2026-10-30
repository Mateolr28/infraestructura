/**
 * Configuración de Jest.
 *
 * El proyecto usa módulos ES nativos ("type": "module"), por eso:
 *  - transform: {}  → Jest no transpila nada.
 *  - los scripts de npm ejecutan Jest con --experimental-vm-modules.
 *
 * Se definen dos proyectos para poder correrlos por separado:
 *   npm run test:unit         → tests/unit
 *   npm run test:integration  → tests/integration
 */
const common = {
  testEnvironment: 'node',
  transform: {},
};

export default {
  verbose: true,
  projects: [
    {
      ...common,
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
    },
    {
      ...common,
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
    },
  ],
  collectCoverageFrom: ['src/**/*.js', '!src/main.js'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'json-summary'],
  coverageThreshold: {
    // El dominio es el núcleo del negocio: se exige cobertura alta.
    './src/domain/': {
      statements: 95,
      branches: 90,
      functions: 95,
      lines: 95,
    },
    global: {
      statements: 85,
      branches: 80,
      functions: 85,
      lines: 85,
    },
  },
};
