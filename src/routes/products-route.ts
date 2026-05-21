import { Elysia, t } from 'elysia';
import {
  createProduct,
  getProducts,
  getProductByProductId,
  updateProduct,
  deleteProduct,
} from '../service/products-service';
import { bearerAuth, getUserIdFromToken } from './auth-middleware';
// import { rateLimit } from '../middleware/rate-limit';

const createProductHandler = new Elysia()
  // .use(rateLimit({ windowMs: 60000, max: 30 }))
  .post(
    '/api/products',
    async ({ body, set, headers }: any) => {
      const authHeader = headers['authorization'] || headers['Authorization'];

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const token = authHeader.substring(7);

      try {
        await getUserIdFromToken(token);

        const product = await createProduct({
          name: body.name,
          description: body.description,
          categoryId: body.category_id ? parseInt(body.category_id) : undefined,
          departmentId: body.department_id,
          isActive: body.is_active,
        });
        set.status = 201;
        return { data: product };
      } catch (err: any) {
        if (err.message === 'Unauthorized') {
          set.status = 401;
          return { error: 'Unauthorized' };
        }
        if (err.message.includes('too long')) {
          set.status = 422;
          return { error: err.message };
        }
        throw err;
      }
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 255 }),
        description: t.Optional(t.String({ maxLength: 255 })),
        category_id: t.Optional(t.String()),
        department_id: t.Optional(t.Number()),
        is_active: t.Optional(t.Boolean()),
      }),
      detail: {
        summary: 'Create a new product',
        tags: ['Products'],
        security: [{ bearerAuth: [] }],
        responses: {
          201: {
            description: 'Product created successfully',
            content: {
              'application/json': {
                example: {
                  data: {
                    product_id: 1,
                    name: 'Indomie Goreng',
                    description: 'Mie instan rasa goreng',
                    category_id: 1,
                    department_id: 2,
                    is_active: true,
                    created_at: '2024-01-01T00:00:00.000Z',
                    updated_at: '2024-01-01T00:00:00.000Z',
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
          422: {
            description: 'Validation error',
          },
        },
      },
    }
  );

const getProductsHandler = new Elysia()
  // .use(rateLimit({ windowMs: 60000, max: 60 }))
  .get(
    '/api/products',
    async ({ query, set, headers }: any) => {
      const authHeader = headers['authorization'] || headers['Authorization'];

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const token = authHeader.substring(7);

      try {
        await getUserIdFromToken(token);

        const filters = {
          page: query.page ? Number(query.page) : undefined,
          limit: query.limit ? Number(query.limit) : undefined,
          isActive: query.is_active !== undefined ? query.is_active : undefined,
          categoryId: query.category_id ? Number(query.category_id) : undefined,
          departmentId: query.department_id
            ? Number(query.department_id)
            : undefined,
        };

        const result = await getProducts(filters);
        return { data: result.data, meta: result.meta };
      } catch (err: any) {
        if (err.message === 'Unauthorized') {
          set.status = 401;
          return { error: 'Unauthorized' };
        }
        throw err;
      }
    },
    {
      query: t.Optional(
        t.Object({
          page: t.Optional(t.Number({ minimum: 1 })),
          limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
          is_active: t.Optional(t.Boolean()),
          category_id: t.Optional(t.String()),
          department_id: t.Optional(t.Number()),
        })
      ),
      detail: {
        summary: 'List all products with optional filters and pagination',
        tags: ['Products'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Products list retrieved successfully',
            content: {
              'application/json': {
                example: {
                  data: [
                    {
                      product_id: 1,
                      name: 'Indomie Goreng',
                      description: 'Mie instan rasa goreng',
                      category_id: 1,
                      department_id: 2,
                      is_active: true,
                      created_at: '2024-01-01T00:00:00.000Z',
                      updated_at: '2024-01-01T00:00:00.000Z',
                    },
                  ],
                  meta: {
                    total: 100,
                    page: 1,
                    limit: 10,
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
        },
      },
    }
  );

const getProductByProductIdHandler = new Elysia()
  // .use(rateLimit({ windowMs: 60000, max: 60 }))
  .get(
    '/api/products/:productId',
    async ({ params, set, headers }: any) => {
      const authHeader = headers['authorization'] || headers['Authorization'];

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const token = authHeader.substring(7);

      try {
        await getUserIdFromToken(token);

        const product = await getProductByProductId(Number(params.productId));
        return { data: product };
      } catch (err: any) {
        if (err.message === 'Unauthorized') {
          set.status = 401;
          return { error: 'Unauthorized' };
        }
        if (err.message === 'Product not found') {
          set.status = 404;
          return { error: err.message };
        }
        throw err;
      }
    },
    {
      params: t.Object({
        productId: t.Number(),
      }),
      detail: {
        summary: 'Get product details by product ID',
        tags: ['Products'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Product details retrieved successfully',
            content: {
              'application/json': {
                example: {
                  data: {
                    product_id: 1,
                    name: 'Laptop Pro X1',
                    description: '15-inch high-performance laptop',
                    category_id: 1,
                    department_id: 10,
                    is_active: true,
                    created_at: '2025-01-01T00:00:00.000Z',
                    updated_at: '2025-01-01T00:00:00.000Z',
                    variants: [
                      {
                        id: 1,
                        product_id: 1,
                        sku: 'LAPTOP-X1-16',
                        variant_name: '16GB/512GB',
                        uom: 'pcs',
                        is_active: true,
                        is_sellable: true,
                        prices: [
                          {
                            id: 1,
                            variant_id: 1,
                            price_type: 'retail',
                            price: '1499.99',
                          },
                        ],
                        costs: [
                          { id: 1, variant_id: 1, cost_price: '1050.00' },
                        ],
                        taxes: [
                          {
                            id: 1,
                            variant_id: 1,
                            tax_code: 'VAT20',
                            is_inclusive: true,
                          },
                        ],
                        barcodes: [
                          { id: 1, variant_id: 1, barcode: '5901234123457' },
                        ],
                        images: [
                          {
                            id: 1,
                            variant_id: 1,
                            image_url:
                              'https://cdn.acme.com/laptop-x1-gray.jpg',
                            is_primary: true,
                          },
                        ],
                        attributes: [
                          {
                            id: 1,
                            variant_id: 1,
                            attribute_name: 'Color',
                            attribute_value: 'Space Gray',
                          },
                        ],
                        inventory: [
                          {
                            id: 1,
                            variant_id: 1,
                            warehouse_id: 1,
                            stock_qty: '120.00',
                            reserved_qty: '15.00',
                          },
                        ],
                      },
                    ],
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
            description: 'Product not found',
            content: {
              'application/json': {
                example: {
                  error: 'Product not found',
                },
              },
            },
          },
          422: {
            description: 'Invalid product ID',
          },
        },
      },
    }
  );

const updateProductHandler = new Elysia()
  // .use(rateLimit({ windowMs: 60000, max: 30 }))
  .patch(
    '/api/products/:productId',
    async ({ params, body, set, headers }: any) => {
      const authHeader = headers['authorization'] || headers['Authorization'];

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const token = authHeader.substring(7);

      // Check if at least one field is provided
      if (
        !body.name &&
        !body.description &&
        body.category_id === undefined &&
        body.department_id === undefined &&
        body.is_active === undefined
      ) {
        set.status = 422;
        return { error: 'At least one field must be provided' };
      }

      try {
        await getUserIdFromToken(token);

        const updatedProduct = await updateProduct(Number(params.productId), {
          name: body.name,
          description: body.description,
          categoryId:
            body.category_id !== undefined
              ? parseInt(body.category_id)
              : undefined,
          departmentId: body.department_id,
          isActive: body.is_active,
        });
        return { data: updatedProduct };
      } catch (err: any) {
        if (err.message === 'Unauthorized') {
          set.status = 401;
          return { error: 'Unauthorized' };
        }
        if (err.message === 'Product not found') {
          set.status = 404;
          return { error: err.message };
        }
        if (err.message.includes('too long')) {
          set.status = 422;
          return { error: err.message };
        }
        throw err;
      }
    },
    {
      params: t.Object({
        productId: t.Number(),
      }),
      body: t.Object({
        name: t.Optional(t.String({ maxLength: 255 })),
        description: t.Optional(t.String({ maxLength: 255 })),
        category_id: t.Optional(t.String()),
        department_id: t.Optional(t.Number()),
        is_active: t.Optional(t.Boolean()),
      }),
      detail: {
        summary: 'Update product by product ID',
        tags: ['Products'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Product updated successfully',
            content: {
              'application/json': {
                example: {
                  data: {
                    product_id: 1,
                    name: 'Indomie Goreng Special',
                    description: 'Edisi terbaru',
                    category_id: 2,
                    department_id: 1,
                    is_active: false,
                    created_at: '2024-01-01T00:00:00.000Z',
                    updated_at: '2024-01-01T00:00:00.000Z',
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
            description: 'Product not found',
            content: {
              'application/json': {
                example: {
                  error: 'Product not found',
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

const deleteProductHandler = new Elysia()
  // .use(rateLimit({ windowMs: 60000, max: 30 }))
  .delete(
    '/api/products/:productId',
    async ({ params, set, headers }: any) => {
      const authHeader = headers['authorization'] || headers['Authorization'];

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const token = authHeader.substring(7);

      try {
        await getUserIdFromToken(token);

        const result = await deleteProduct(Number(params.productId));
        return { data: result };
      } catch (err: any) {
        if (err.message === 'Product not found') {
          set.status = 404;
          return { error: err.message };
        }
        throw err;
      }
    },
    {
      params: t.Object({
        productId: t.Number(),
      }),
      detail: {
        summary: 'Soft delete product by product ID',
        tags: ['Products'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Product soft deleted successfully',
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
            description: 'Product not found',
            content: {
              'application/json': {
                example: {
                  error: 'Product not found',
                },
              },
            },
          },
          422: {
            description: 'Invalid product ID',
          },
        },
      },
    }
  );

export const productsRoute = new Elysia()
  .use(createProductHandler)
  .use(getProductsHandler)
  .use(getProductByProductIdHandler)
  .use(updateProductHandler)
  .use(deleteProductHandler);
