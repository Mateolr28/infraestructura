/**
 * Enrutador mínimo sobre el módulo http nativo de Node.
 * Soporta parámetros de ruta del tipo /api/documentos/:id
 */
export class Router {
  #routes = [];

  add(method, path, handler) {
    const keys = [];
    const pattern = path.replace(/:([A-Za-z_]+)/g, (_, key) => {
      keys.push(key);
      return '([^/]+)';
    });
    this.#routes.push({
      method,
      regex: new RegExp(`^${pattern}/?$`),
      keys,
      handler,
    });
    return this;
  }

  get(path, h) { return this.add('GET', path, h); }
  post(path, h) { return this.add('POST', path, h); }
  patch(path, h) { return this.add('PATCH', path, h); }

  /**
   * @returns {{ handler: Function, params: object } | { methodNotAllowed: true } | null}
   */
  match(method, pathname) {
    let pathMatched = false;
    for (const route of this.#routes) {
      const m = route.regex.exec(pathname);
      if (!m) continue;
      pathMatched = true;
      if (route.method !== method) continue;
      const params = Object.fromEntries(
        route.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]),
      );
      return { handler: route.handler, params };
    }
    return pathMatched ? { methodNotAllowed: true } : null;
  }
}
