import { Elysia, t } from 'elysia';
import { authMiddleware } from '../middleware/auth-middleware';
import {
  createProductCost,
  getProductCostsByVariant,
  getCurrentProductCost,
  updateProductCost,
  deleteProductCost,
} from '../service/product-costs-service.js';



export const productCostsRoute = new Elysia({ prefix: '/api' })
  .use(authMiddleware)
  .onError(({ error, set }) => {
    if (error.name === 'ValidationError') {
      set.status = 422;
      return { error: 'Validation error' };
    }
  })
  .post('/product-costs', async ({ body, set, user }) => {
    try {
      const result = await createProductCost({
        variantId: body.variant_id,
        costPrice: body.cost_price,
        effectiveDate: body.effective_date,
      });
      set.status = 201;
      return { data: result };
    } catch (error: any) {
      if (error.message === 'Variant tidak ditemukan') {
        set.status = 404;
        return { error: 'Variant tidak ditemukan' };
      }
      throw error;
    }
  }, {
    body: t.Object({
      variant_id: t.Number(),
      cost_price: t.Number({ minimum: 0 }),
      effective_date: t.Date(),
    }),
    detail: {
      summary: 'Create a new product cost record',
      tags: ['Product Costs'],
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['variant_id', 'cost_price', 'effective_date'],
              properties: {
                variant_id: {
                  type: 'number',
                  description: 'The ID of the product variant',
                  example: 1,
                },
                cost_price: {
                  type: 'number',
                  minimum: 0,
                  description: 'The cost price of the product',
                  example: 150000.0,
                },
                effective_date: {
                  type: 'string',
                  format: 'date-time',
                  description: 'The date when this cost becomes effective',
                  example: '2026-01-01T00:00:00.000Z',
                },
              },
            },
          },
        },
      },
      responses: {
        201: {
          description: 'Product cost created successfully',
          content: {
            'application/json': {
              example: {
                data: {
                  id: 1,
                  variant_id: 1,
                  cost_price: '150000.00',
                  effective_date: '2026-01-01T00:00:00.000Z',
                  created_at: '2026-01-01T00:00:00.000Z',
                },
              },
            },
          },
        },
        401: {
          description: 'Unauthorized',
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
        422: {
          description: 'Validation error',
          content: {
            'application/json': {
              example: {
                error: 'cost_price is required',
              },
            },
          },
        },
      },
    },
  })

  .get('/product-costs/:variantId', async ({ params, set, user }) => {
    try {
      const result = await getProductCostsByVariant(parseInt(params.variantId));
      return { data: result };
    } catch (error: any) {
      if (error.message === 'Variant tidak ditemukan') {
        set.status = 404;
        return { error: 'Variant tidak ditemukan' };
      }
      throw error;
    }
    try {
      const result = await getProductCostsByVariant(params.variantId);
      return { data: result };
    } catch (error) {
      set.status = 404;
      return { error: 'Variant tidak ditemukan' };
    }
  }, {
    params: t.Object({
      variantId: t.Number(),
    }),
    detail: {
      summary: 'Get all product cost records for a specific variant',
      tags: ['Product Costs'],
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'List of product costs',
          content: {
            'application/json': {
              example: {
                data: [
                  {
                    id: 1,
                    variant_id: 1,
                    cost_price: '150000.00',
                    effective_date: '2026-01-01T00:00:00.000Z',
                    created_at: '2026-01-01T00:00:00.000Z',
                  },
                ],
              },
            },
          },
        },
        401: {
          description: 'Unauthorized',
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
      },
    },
  })

  .get('/product-costs/:variantId/current', async ({ params, set, user }) => {
    try {
      const result = await getCurrentProductCost(parseInt(params.variantId));
      return { data: result };
    } catch (error: any) {
      if (error.message === 'Variant tidak ditemukan') {
        set.status = 404;
        return { error: 'Variant tidak ditemukan' };
      }
      if (error.message === 'Harga pokok aktif tidak ditemukan') {
        set.status = 404;
        return { error: 'Harga pokok aktif tidak ditemukan' };
      }
      throw error;
    }
    try {
      const result = await getCurrentProductCost(params.variantId);
      return { data: result };
    } catch (error) {
      set.status = 404;
      return { error: 'Harga pokok aktif tidak ditemukan' };
    }
  }, {
    params: t.Object({
      variantId: t.Number(),
    }),
    detail: {
      summary: 'Get the current active product cost for a specific variant',
      tags: ['Product Costs'],
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Current active product cost',
          content: {
            'application/json': {
              example: {
                data: {
                  id: 1,
                  variant_id: 1,
                  cost_price: '150000.00',
                  effective_date: '2026-01-01T00:00:00.000Z',
                  created_at: '2026-01-01T00:00:00.000Z',
                },
              },
            },
          },
        },
        401: {
          description: 'Unauthorized',
          content: {
            'application/json': {
              example: {
                error: 'Unauthorized',
              },
            },
          },
        },
        404: {
          description: 'Variant not found or no active cost',
          content: {
            'application/json': {
              example: {
                error: 'Harga pokok aktif tidak ditemukan',
              },
            },
          },
        },
      },
    },
  })

  .patch('/product-costs/:id', async ({ params, body, set, user }) => {
    try {
      await updateProductCost(parseInt(params.id), {
        costPrice: body.cost_price,
        effectiveDate: body.effective_date,
      });
      set.status = 200;
      return { data: 'OK' };
    } catch (error: any) {
      if (error.message === 'Data tidak ditemukan') {
        set.status = 404;
        return { error: 'Data tidak ditemukan' };
      }
      throw error;
    }
  }, {
    params: t.Object({
      id: t.Number(),
    }),
    body: t.Object({
      cost_price: t.Optional(t.Number({ minimum: 0 })),
      effective_date: t.Optional(t.Date()),
    }),
    detail: {
      summary: 'Update a product cost record',
      tags: ['Product Costs'],
      security: [{ bearerAuth: [] }],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                cost_price: {
                  type: 'number',
                  minimum: 0,
                  description: 'The updated cost price',
                  example: 175000.0,
                },
                effective_date: {
                  type: 'string',
                  format: 'date-time',
                  description: 'The updated effective date',
                  example: '2026-06-01T00:00:00.000Z',
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Product cost updated successfully',
          content: {
            'application/json': {
              example: {
                data: 'OK',
              },
            },
          },
        },
        401: {
          description: 'Unauthorized',
          content: {
            'application/json': {
              example: {
                error: 'Unauthorized',
              },
            },
          },
        },
        404: {
          description: 'Record not found',
          content: {
            'application/json': {
              example: {
                error: 'Data tidak ditemukan',
              },
            },
          },
        },
        422: {
          description: 'Validation error',
          content: {
            'application/json': {
              example: {
                error: 'At least one field must be provided',
              },
            },
          },
        },
      },
    },
  })

  .delete('/product-costs/:id', async ({ params, set, user }) => {
    try {
      await deleteProductCost(parseInt(params.id));
      set.status = 200;
      return { data: 'OK' };
    } catch (error: any) {
      if (error.message === 'Data tidak ditemukan') {
        set.status = 404;
        return { error: 'Data tidak ditemukan' };
      }
      throw error;
    }
    try {
      const result = await deleteProductCost(params.id);
      return { data: result };
    } catch (error) {
      set.status = 404;
      return { error: 'Data tidak ditemukan' };
    }
  }, {
    params: t.Object({
      id: t.Number(),
    }),
    detail: {
      summary: 'Delete a product cost record',
      tags: ['Product Costs'],
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Product cost deleted successfully',
          content: {
            'application/json': {
              example: {
                data: 'OK',
              },
            },
          },
        },
        401: {
          description: 'Unauthorized',
          content: {
            'application/json': {
              example: {
                error: 'Unauthorized',
              },
            },
          },
        },
        404: {
          description: 'Record not found',
          content: {
            'application/json': {
              example: {
                error: 'Data tidak ditemukan',
              },
            },
          },
        },
      },
    },
  });