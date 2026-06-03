// Import side-effects: registers all schemas and routes into the OpenAPI registry
import './openapi/schemas.js';
import './openapi/routes.js';

import { buildOpenApiSpec } from './openapi/registry.js';

export const openApiSpec = buildOpenApiSpec();
