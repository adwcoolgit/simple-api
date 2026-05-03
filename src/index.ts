import { Elysia } from 'elysia';
import { openapi } from '@elysiajs/openapi';
import { routes } from './routes';
import { usersRoute } from './routes/users-route';
import { loggerMiddleware } from './middleware/logger';

const app = new Elysia()
  .use(loggerMiddleware)
  .use(routes)
  .use(usersRoute)
  .listen(Bun.env.PORT || 3000);
try {
  const app = new Elysia()
  .use(openapi({
    documentation: {
      info: {
        title: 'Users API',
        version: '1.0.0',
        description: 'REST API for user authentication and management'
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      }
    }
  }))
    .use(routes)
    .use(usersRoute)
    .listen(Bun.env.PORT || 3000);

  console.log(
    'Server running on ' +
      (app.server?.hostname || 'localhost') +
      ':' +
      (app.server?.port || 3000)
  );
} catch (error) {
  console.error('Failed to start server:', error);
  process.exit(1);
}
