import { INestApplication, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ModulesContainer } from '@nestjs/core';
import { OpenAPIObject } from '@nestjs/swagger';
import request from 'supertest';
import type { App } from 'supertest/types';
import { IS_PUBLIC_KEY } from '../src/auth/decorators/public.decorator';
import { createTestApp } from './utils/e2e';

interface RegisteredRoute {
  /** OpenAPI-style identity, e.g. "get /classes/{id}". */
  key: string;
  /** Marked @Public(), so it bypasses the global JwtAuthGuard. */
  isPublic: boolean;
}

/**
 * Guards the API docs, which are easy to break silently: Swagger is wired up in
 * setup-app.ts rather than in any controller, so nothing else in the suite fails
 * if it goes missing. It has already been lost once — the branch that added
 * /classes was cut before Swagger landed, and merging it reverted main.ts.
 *
 * Note: the @nestjs/swagger CLI plugin (nest-cli.json) only runs under `nest
 * build`, not ts-jest, so DTO request/response schemas are thinner here than in
 * a real run. These tests therefore assert on routes, tags and security — all
 * decorator-driven, and identical either way.
 */
describe('Swagger docs (e2e)', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  const server = () => app.getHttpServer() as App;

  beforeAll(async () => {
    ({ app, document } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('serving', () => {
    it('serves the interactive UI at the root path', async () => {
      const res = await request(server()).get('/').expect(200);

      expect(res.headers['content-type']).toMatch(/html/);
      expect(res.text).toMatch(/swagger-ui/i);
    });

    it('serves the raw spec at /swagger.json without a token', async () => {
      // No Authorization header: the docs sit above the global JwtAuthGuard and
      // must stay reachable, otherwise the UI can't load its own definition.
      const res = await request(server()).get('/swagger.json').expect(200);

      const spec = res.body as OpenAPIObject;
      expect(spec.openapi).toMatch(/^3\./);
      expect(spec.info.title).toBe('Bloom Room API');
      expect(Object.keys(spec.paths).length).toBeGreaterThan(0);
    });

    it('offers bearer auth so protected routes can be tried from the UI', () => {
      expect(document.components?.securitySchemes).toMatchObject({
        bearer: { type: 'http', scheme: 'bearer' },
      });
    });
  });

  describe('coverage', () => {
    /**
     * Every route Nest actually registered, in OpenAPI form ("get /classes/{id}").
     * Read back off the controller metadata rather than a hand-written list, so
     * new endpoints are picked up automatically instead of needing this spec
     * updated alongside them.
     */
    const registeredRoutes = (): RegisteredRoute[] => {
      const verbs: Partial<Record<RequestMethod, string>> = {
        [RequestMethod.GET]: 'get',
        [RequestMethod.POST]: 'post',
        [RequestMethod.PUT]: 'put',
        [RequestMethod.PATCH]: 'patch',
        [RequestMethod.DELETE]: 'delete',
        [RequestMethod.OPTIONS]: 'options',
        [RequestMethod.HEAD]: 'head',
      };

      // Express-style params (":id") become OpenAPI templates ("{id}").
      const normalise = (path: string) =>
        `/${path.split('/').filter(Boolean).join('/')}`.replace(
          /:([^/]+)/g,
          '{$1}',
        );

      const routes: RegisteredRoute[] = [];

      for (const module of app.get(ModulesContainer).values()) {
        for (const controller of module.controllers.values()) {
          const ctor = controller.metatype;
          if (!ctor) continue;

          const base = (Reflect.getMetadata(PATH_METADATA, ctor) ??
            '/') as string;
          const publicController =
            Reflect.getMetadata(IS_PUBLIC_KEY, ctor) === true;
          const proto = ctor.prototype as object;

          for (const name of Object.getOwnPropertyNames(proto)) {
            if (name === 'constructor') continue;

            const handler = (proto as Record<string, unknown>)[name];
            if (typeof handler !== 'function') continue;

            const path = Reflect.getMetadata(PATH_METADATA, handler) as
              | string
              | undefined;
            if (path === undefined) continue; // not a route handler

            const method = Reflect.getMetadata(
              METHOD_METADATA,
              handler,
            ) as RequestMethod;
            const verb = verbs[method];
            if (!verb) continue;

            routes.push({
              key: `${verb} ${normalise(`${base}/${path}`)}`,
              // Mirrors JwtAuthGuard: handler metadata overrides the class.
              isPublic:
                (Reflect.getMetadata(IS_PUBLIC_KEY, handler) as
                  | boolean
                  | undefined) ?? publicController,
            });
          }
        }
      }

      return routes.sort((a, b) => a.key.localeCompare(b.key));
    };

    const HTTP_VERBS = [
      'get',
      'post',
      'put',
      'patch',
      'delete',
      'options',
      'head',
    ];

    const documentedRoutes = (): string[] =>
      Object.entries(document.paths)
        .flatMap(([path, item]) =>
          Object.keys(item)
            .filter((key) => HTTP_VERBS.includes(key))
            .map((verb) => `${verb} ${path}`),
        )
        .sort();

    it('documents every route the app registers', () => {
      const registered = registeredRoutes();
      const documented = new Set(documentedRoutes());

      // Sanity check: if reflection stops finding routes this test would pass
      // vacuously, which is exactly the failure mode it exists to prevent.
      expect(registered.length).toBeGreaterThan(0);

      const missing = registered
        .map((route) => route.key)
        .filter((key) => !documented.has(key));
      expect(missing).toEqual([]);
    });

    it('marks guard-protected routes as needing bearer auth', () => {
      // Without @ApiBearerAuth the UI's Authorize button doesn't attach the
      // token to that operation, so "Try it out" just returns 401 — the docs
      // look fine but are unusable. Swagger infers tags on its own, but never
      // this, so it's the decorator most likely to be forgotten on a new route.
      const secured = new Set(
        Object.entries(document.paths).flatMap(([path, item]) =>
          Object.entries(item as Record<string, { security?: unknown[] }>)
            .filter(([verb]) => HTTP_VERBS.includes(verb))
            .filter(([, op]) => op.security?.length)
            .map(([verb]) => `${verb} ${path}`),
        ),
      );

      const undocumented = registeredRoutes()
        .filter((route) => !route.isPublic)
        .map((route) => route.key)
        .filter((key) => !secured.has(key));

      expect(undocumented).toEqual([]);
    });
  });
});
