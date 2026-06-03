import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';

export const registry = new OpenAPIRegistry();

export function buildOpenApiSpec(): object {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Naologic Production Reflow API',
      version: '1.0.0',
      description: 'REST API for work-order timeline management and reflow scheduling',
    },
    servers: [{ url: '/api' }],
  });
}
