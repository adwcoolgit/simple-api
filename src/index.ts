import { Elysia } from 'elysia';
import { routes } from './routes';
import { usersRoute } from './routes/users-route';
import { loggerMiddleware } from './middleware/logger';

const app = new Elysia()
  .use(loggerMiddleware)
  .use(routes)
  .use(usersRoute)
  .listen(Bun.env.PORT || 3000);

console.log(
  'Server running on ' +
    (app.server?.hostname || 'localhost') +
    ':' +
    (app.server?.port || 3000)
);
