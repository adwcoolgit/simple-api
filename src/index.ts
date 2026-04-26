import { Elysia } from 'elysia';
import { routes } from './routes';
import { usersRoute } from './routes/users-route';
import { db } from './db';
import { users } from './db/schema';

const app = new Elysia()
  .use(routes)
  .use(usersRoute)
  .get('/users', async () => {
    const allUsers = await db.select().from(users);
    // Remove password from all users
    return {
      users: allUsers.map((u) => {
        const { password, createdAt, ...rest } = u;
        return rest;
      }),
    };
  })
  .listen(Bun.env.PORT || 3000);

console.log(
  'Server running on ' +
    (app.server?.hostname || 'localhost') +
    ':' +
    (app.server?.port || 3000)
);
