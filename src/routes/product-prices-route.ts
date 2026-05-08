import { Elysia, t } from 'elysia';
import {
  createProductPrice,
  getProductPrices,
  getProductPriceById,
  updateProductPrice,
  deleteProductPrice,
} from '../service/product-prices-service';
import { bearerAuth, getUserIdFromToken } from './auth-middleware';
// import { rateLimit } from '../middleware/rate-limit';

const createProductPriceHandler = new Elysia()
  // .use(rateLimit({ windowMs: 60000, max: 30 }))
  .post(
    '/api/product-prices',
    async ({ body, set, headers }: any) => {
      const authHeader = headers['authorization'] || headers['Authorization'];

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const token = authHeader.substring(7);

      try {
        await getUserIdFromToken(token);

        const price = await createProductPrice({
          variant_id: body.variant_id,
          price_type: body.price_type,
          price: body.price,
          start_date: body.start_date,
          end_date: body.end_date,
        });
        set.status = 201;
        return { data: price };
      } catch (err: any) {
        if (err.message === 'Variant tidak ditemukan') {
          set.status = 404;
          return { error: err.message };
        }
        if (err.message.includes('Sudah ada harga')) {
          set.status = 409;
          return { error: err.message };
        }
        if (err.message.includes('must be greater than 0') || err.message.includes('start_date must be before')) {
          set.status = 422;
          return { error: err.message };
        }
        throw err;
      }
    },
    {
      body: t.Object({
        variant_id: t.Number(),
        price_type: t.Union([t.Literal('retail'), t.Literal('member'), t.Literal('reseller')]),
        price: t.Number({ minimum: 0.01 }),
        start_date: t.Optional(t.String()),
        end_date: t.Optional(t.String()),
      }),
      detail: {
        summary: 'Create a new product price',
        tags: ['Product Prices'],
        security: [{ bearerAuth: [] }],
        responses: {
          201: {
            description: 'Product price created successfully',
            content: {
              'application/json': {
                example: {
                  data: {
                    id: 1,
                    variant_id: 1,
                    price_type: 'retail',
                    price: '150000.00',
                    start_date: '2026-01-01T00:00:00.000Z',
                    end_date: '2026-12-31T23:59:59.000Z',
                  },
                },
              },
            },
          },
          401: {
            description: 'Unauthorized - invalid or missing token',
            content: {
              'application/json': {
                example: {
                  error: 'Unauthorized',
                },
              },
            },
          },
          404: {
            description: 'Variant not found',
            content: {
              'application/json': {
                example: {
                  error: 'Variant tidak ditemukan',
                },
              },
            },
          },
          409: {
            description: 'Overlap with existing price',
            content: {
              'application/json': {
                example: {
                  error: 'Sudah ada harga untuk tipe dan rentang tanggal ini',
                },
              },
            },
          },
          422: {
            description: 'Validation error',
          },
        },
      },
    }
  );

const getProductPricesHandler = new Elysia()
  .get(
    '/api/product-prices',
    async ({ query, set }: any) => {
      try {
        const filters = {
          variant_id: query.variant_id ? Number(query.variant_id) : undefined,
          price_type: query.price_type as 'retail' | 'member' | 'reseller' | undefined,
          page: query.page ? Number(query.page) : undefined,
          limit: query.limit ? Number(query.limit) : undefined,
        };

        const result = await getProductPrices(filters);
        return { data: result.data, meta: result.meta };
      } catch (err: any) {
        throw err;
      }
    },
    {
      query: t.Optional(
        t.Object({
          variant_id: t.Optional(t.Number()),
          price_type: t.Optional(t.Union([t.Literal('retail'), t.Literal('member'), t.Literal('reseller')])),
          page: t.Optional(t.Number({ minimum: 1 })),
          limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
        })
      ),
      detail: {
        summary: 'List all product prices with optional filters and pagination',
        tags: ['Product Prices'],
        responses: {
          200: {
            description: 'Product prices list retrieved successfully',
            content: {
              'application/json': {
                example: {
                  data: [
                    {
                      id: 1,
                      variant_id: 1,
                      price_type: 'retail',
                      price: '150000.00',
                      start_date: '2026-01-01T00:00:00.000Z',
                      end_date: '2026-12-31T23:59:59.000Z',
                    },
                  ],
                  meta: {
                    total: 1,
                    page: 1,
                    limit: 10,
                  },
                },
              },
            },
          },
        },
      },
    }
  );

const getProductPriceByIdHandler = new Elysia()
  .get(
    '/api/product-prices/:id',
    async ({ params, set }: any) => {
      try {
        const price = await getProductPriceById(Number(params.id));
        return { data: price };
      } catch (err: any) {
        if (err.message === 'Harga tidak ditemukan') {
          set.status = 404;
          return { error: err.message };
        }
        throw err;
      }
    },
    {
      params: t.Object({
        id: t.Number(),
      }),
      detail: {
        summary: 'Get product price details by ID',
        tags: ['Product Prices'],
        responses: {
          200: {
            description: 'Product price details retrieved successfully',
            content: {
              'application/json': {
                example: {
                  data: {
                    id: 1,
                    variant_id: 1,
                    price_type: 'retail',
                    price: '150000.00',
                    start_date: '2026-01-01T00:00:00.000Z',
                    end_date: '2026-12-31T23:59:59.000Z',
                  },
                },
              },
            },
          },
          404: {
            description: 'Product price not found',
            content: {
              'application/json': {
                example: {
                  error: 'Harga tidak ditemukan',
                },
              },
            },
          },
          422: {
            description: 'Invalid ID',
          },
        },
      },
    }
  );

const getActiveProductPricesHandler = new Elysia()
  .get(
    '/api/product-prices/active',
    async ({ query }: any) => {
      try {
        const filters = {
          variant_id: query.variant_id ? Number(query.variant_id) : undefined,
          price_type: query.price_type as 'retail' | 'member' | 'reseller' | undefined,
        };

        const result = await getActiveProductPrices(filters);
        return { data: result.data };
      } catch (err: any) {
        throw err;
      }
    },
    {
      query: t.Optional(
        t.Object({
          variant_id: t.Optional(t.Number()),
          price_type: t.Optional(t.Union([t.Literal('retail'), t.Literal('member'), t.Literal('reseller')])),
        })
      ),
      detail: {
        summary: 'List active product prices',
        tags: ['Product Prices'],
        responses: {
          200: {
            description: 'Active product prices retrieved successfully',
            content: {
              'application/json': {
                example: {
                  data: [
                    {
                      id: 1,
                      variant_id: 1,
                      price_type: 'member',
                      price: '120000.00',
                      start_date: '2026-01-01T00:00:00.000Z',
                      end_date: null,
                    },
                  ],
                },
              },
            },
          },
        },
      },
    }
  );

const updateProductPriceHandler = new Elysia()
  // .use(rateLimit({ windowMs: 60000, max: 30 }))
  .patch(
    '/api/product-prices/:id',
    async ({ params, body, set, headers }: any) => {
      const authHeader = headers['authorization'] || headers['Authorization'];

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const token = authHeader.substring(7);

      // Check if at least one field is provided
      if (body.price === undefined && body.start_date === undefined && body.end_date === undefined) {
        set.status = 422;
        return { error: 'At least one field must be provided' };
      }

      try {
        await getUserIdFromToken(token);

        const result = await updateProductPrice(Number(params.id), {
          price: body.price,
          start_date: body.start_date,
          end_date: body.end_date,
        });
        return { data: result };
      } catch (err: any) {
        if (err.message === 'Harga tidak ditemukan') {
          set.status = 404;
          return { error: err.message };
        }
        if (err.message.includes('Sudah ada harga')) {
          set.status = 409;
          return { error: err.message };
        }
        if (err.message.includes('must be greater than 0') || err.message.includes('start_date must be before')) {
          set.status = 422;
          return { error: err.message };
        }
        throw err;
      }
    },
    {
      params: t.Object({
        id: t.Number(),
      }),
      body: t.Object({
        price: t.Optional(t.Number({ minimum: 0.01 })),
        start_date: t.Optional(t.String()),
        end_date: t.Optional(t.String()),
      }),
      detail: {
        summary: 'Update product price by ID',
        tags: ['Product Prices'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Product price updated successfully',
            content: {
              'application/json': {
                example: {
                  data: 'OK',
                },
              },
            },
          },
          401: {
            description: 'Unauthorized - invalid or missing token',
            content: {
              'application/json': {
                example: {
                  error: 'Unauthorized',
                },
              },
            },
          },
          404: {
            description: 'Product price not found',
            content: {
              'application/json': {
                example: {
                  error: 'Harga tidak ditemukan',
                },
              },
            },
          },
          409: {
            description: 'Overlap with existing price after update',
            content: {
              'application/json': {
                example: {
                  error: 'Sudah ada harga untuk tipe dan rentang tanggal ini',
                },
              },
            },
          },
          422: {
            description: 'Validation error or empty body',
          },
        },
      },
    }
  );

const deleteProductPriceHandler = new Elysia()
  // .use(rateLimit({ windowMs: 60000, max: 30 }))
  .delete(
    '/api/product-prices/:id',
    async ({ params, set, headers }: any) => {
      const authHeader = headers['authorization'] || headers['Authorization'];

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const token = authHeader.substring(7);

      try {
        await getUserIdFromToken(token);

        const result = await deleteProductPrice(Number(params.id));
        return { data: result };
      } catch (err: any) {
        if (err.message === 'Harga tidak ditemukan') {
          set.status = 404;
          return { error: err.message };
        }
        throw err;
      }
    },
    {
      params: t.Object({
        id: t.Number(),
      }),
      detail: {
        summary: 'Delete product price by ID',
        tags: ['Product Prices'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Product price deleted successfully',
            content: {
              'application/json': {
                example: {
                  data: 'OK',
                },
              },
            },
          },
          401: {
            description: 'Unauthorized - invalid or missing token',
            content: {
              'application/json': {
                example: {
                  error: 'Unauthorized',
                },
              },
            },
          },
          404: {
            description: 'Product price not found',
            content: {
              'application/json': {
                example: {
                  error: 'Harga tidak ditemukan',
                },
              },
            },
          },
          422: {
            description: 'Invalid ID',
          },
        },
      },
    }
  );

export const productPricesRoute = new Elysia()
  .use(createProductPriceHandler)
  .use(getProductPricesHandler)
  .use(getProductPriceByIdHandler)
  .use(getActiveProductPricesHandler)
  .use(updateProductPriceHandler)
  .use(deleteProductPriceHandler);
