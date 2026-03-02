/**
 * OpenAPI/Swagger documentation setup
 */

import { Express, Request, Response } from 'express';
import { defaultLogger } from '../../../utils/logger';

const logger = defaultLogger.child({ module: 'OpenAPI' });

/**
 * OpenAPI specification
 */
const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Autonomous DMX Engine API',
    version: '0.1.0',
    description: 'REST API for controlling the autonomous DMX lighting engine',
    contact: {
      name: 'Development Team',
      email: 'dev@example.com',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
  ],
  tags: [
    { name: 'Status', description: 'Health and status endpoints' },
    { name: 'Metrics', description: 'System and audio metrics' },
    { name: 'Configuration', description: 'Configuration management' },
    { name: 'Control', description: 'System control commands' },
    { name: 'Fixtures', description: 'Fixture management' },
    { name: 'Scenes', description: 'Scene management' },
    { name: 'Logs', description: 'Log retrieval' },
  ],
  paths: {
    '/api/status': {
      get: {
        tags: ['Status'],
        summary: 'Get system status',
        description: 'Returns overall system status including component health',
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'object' },
                    timestamp: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/health': {
      get: {
        tags: ['Status'],
        summary: 'Health check',
        description: 'Returns health status of all components',
        responses: {
          '200': {
            description: 'System is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        healthy: { type: 'boolean' },
                        checks: { type: 'array' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/metrics': {
      get: {
        tags: ['Metrics'],
        summary: 'Get all metrics',
        description: 'Returns aggregated metrics from all system components',
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'object' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/control/mode': {
      post: {
        tags: ['Control'],
        summary: 'Set system mode',
        description: 'Change the operating mode of the system',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  mode: {
                    type: 'string',
                    enum: ['auto', 'manual', 'scene', 'test'],
                  },
                },
                required: ['mode'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Mode changed successfully',
          },
          '400': {
            description: 'Invalid mode',
          },
        },
      },
    },
    '/api/control/intensity': {
      post: {
        tags: ['Control'],
        summary: 'Set global intensity',
        description: 'Set the global intensity (0-1)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  intensity: {
                    type: 'number',
                    minimum: 0,
                    maximum: 1,
                  },
                },
                required: ['intensity'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Intensity changed successfully',
          },
          '400': {
            description: 'Invalid intensity value',
          },
        },
      },
    },
    '/api/control/blackout': {
      post: {
        tags: ['Control'],
        summary: 'Enable/disable blackout',
        description: 'Turn all lights off (blackout) or restore',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  enable: {
                    type: 'boolean',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Blackout changed successfully',
          },
        },
      },
    },
    '/api/config/venues': {
      get: {
        tags: ['Configuration'],
        summary: 'Get available venues',
        description: 'Returns list of all configured venues',
        responses: {
          '200': {
            description: 'Successful response',
          },
        },
      },
    },
    '/api/config/venues/{venueId}/switch': {
      post: {
        tags: ['Configuration'],
        summary: 'Switch to a different venue',
        description: 'Switch the active venue configuration',
        parameters: [
          {
            name: 'venueId',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Venue switched successfully',
          },
          '404': {
            description: 'Venue not found',
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
};

/**
 * Setup OpenAPI documentation
 */
export function setupOpenAPI(app: Express): void {
  try {
    // Serve OpenAPI spec as JSON
    app.get('/api-docs.json', (req: Request, res: Response) => {
      res.json(openApiSpec);
    });
    
    // Simple HTML page with Swagger UI CDN (if swagger-ui-express not installed)
    app.get('/api-docs', (req: Request, res: Response) => {
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Autonomous DMX Engine API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css">
  <style>
    body { margin: 0; padding: 0; }
    #swagger-ui { padding: 20px; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: '/api-docs.json',
        dom_id: '#swagger-ui',
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>
      `;
      res.send(html);
    });
    
    logger.info('OpenAPI documentation available at /api-docs');
  } catch (error) {
    logger.error('Failed to setup OpenAPI documentation', { error });
  }
}