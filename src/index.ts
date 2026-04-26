import { Elysia } from 'elysia';
import { routes } from './routes';
import { db } from './db';
import { users } from './db/schema';

const app = new Elysia()
  .use(routes)
  .get('/users', async () => {
    const allUsers = await db.select().from(users);
    return { users: allUsers };
  })
  .listen(Bun.env.PORT || 3000);

console.log('Server running on ' + (app.server?.hostname || 'localhost') + ':' + (app.server?.port || 3000));
