import { Elysia } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { routes } from './routes';
import { usersRoute } from './routes/users-route';
import { loggerMiddleware } from './middleware/logger';

const app = new Elysia()
  .use(loggerMiddleware)
  .use(swagger({
    path: '/openapi'
  }))
  .use(routes)
  .use(usersRoute)
  .get('/test', () => ({ message: 'Test endpoint' }), {
    detail: {
      summary: 'Test endpoint for Swagger',
      tags: ['Test']
    }
  })
  .listen(Bun.env.PORT || 3000);



console.log(
  '🚀 Server running on ' +
    (app.server?.hostname || 'localhost') +
    ':' +
    (app.server?.port || 3000)
);

console.log('📖 Swagger UI available at: http://localhost:3000/openapi');
console.log('📄 OpenAPI JSON available at: http://localhost:3000/openapi/json');
