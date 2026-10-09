/**
 * Error con status HTTP y mensaje para el usuario: los wrappers de `api-admin.ts` lo devuelven
 * tal cual. Los de cada módulo (`NominaError`, `AsistenciaError`, …) lo extienden. Vive aparte
 * (sin dependencias) para que lo puedan usar los módulos puros y sus tests.
 */
export class ApiError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = new.target.name;
  }
}
