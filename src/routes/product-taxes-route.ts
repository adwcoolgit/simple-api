import { Elysia, t } from 'elysia';
import {
  createProductTax,
  getProductTaxByVariantId,
  updateProductTax,
  deleteProductTax,
} from '../service/product-taxes-service';
import { getUserIdFromToken } from './auth-middleware';

export const productTaxesRoute = new Elysia({ prefix: '/api', tags: ['Product Taxes'] })
  .onError(({ error, set }) => {
    if (error instanceof Error && error.name === 'ValidationError') {
      set.status = 422;
      return { error: 'Validation error' };
    }
  })
  .post('/product-taxes', async ({ body, set, headers }) => {
    const authHeader = headers['authorization'] || headers['Authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    const token = authHeader.substring(7);

    try {
      await getUserIdFromToken(token);

      console.log('Route received body:', body);
      const result = await createProductTax({
        variantId: body.variant_id,
        tax_code: body.tax_code,
        is_inclusive: body.is_inclusive,
      });
      set.status = 201;
      return { data: result };
    } catch (error: any) {
      if (error.message === 'Unauthorized') {
        set.status = 401;
        return { error: 'Unauthorized' };
      }
      if (error.message === 'Variant tidak ditemukan') {
        set.status = 404;
        return { error: error.message };
      }
      if (error.message === 'Variant sudah memiliki konfigurasi pajak') {
        set.status = 409;
        return { error: error.message };
      }
      throw error;
    }
  }, {
    body: t.Object({
      variant_id: t.Number(),
      tax_code: t.Optional(t.String({ maxLength: 20 })),
      is_inclusive: t.Optional(t.Boolean()),
    }),
    detail: {
      summary: 'Add tax configuration for a variant',
      tags: ['Product Taxes'],
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            example: {
              variant_id: 1,
              tax_code: 'PPN-11',
              is_inclusive: false,
            },
          },
        },
      },
      responses: {
        201: {
          description: 'Tax configuration created successfully',
          content: {
            'application/json': {
              example: {
                data: {
                  id: 1,
                  variant_id: 1,
                  tax_code: 'PPN-11',
                  is_inclusive: false,
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
          description: 'Variant already has tax configuration',
          content: {
            'application/json': {
              example: {
                error: 'Variant sudah memiliki konfigurasi pajak',
              },
            },
          },
        },
        422: {
          description: 'Validation error',
          content: {
            'application/json': {
              example: {
                error: 'Validation error',
              },
            },
          },
        },
      },
    },
  })

  .get('/product-taxes/:variantId', async ({ params, set, headers }) => {
    const authHeader = headers['authorization'] || headers['Authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    const token = authHeader.substring(7);

    try {
      await getUserIdFromToken(token);

      const result = await getProductTaxByVariantId(parseInt(params.variantId));
      return { data: result };
    } catch (error: any) {
      if (error.message === 'Unauthorized') {
        set.status = 401;
        return { error: 'Unauthorized' };
      }
      if (error.message === 'Konfigurasi pajak tidak ditemukan') {
        set.status = 404;
        return { error: error.message };
      }
      throw error;
    }
  }, {
    params: t.Object({
      variantId: t.Number(),
    }),
    detail: {
      summary: 'Get tax configuration by variant ID',
      tags: ['Product Taxes'],
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Tax configuration retrieved successfully',
          content: {
            'application/json': {
              example: {
                data: {
                  id: 1,
                  variant_id: 1,
                  tax_code: 'PPN-11',
                  is_inclusive: false,
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
          description: 'Tax configuration not found',
          content: {
            'application/json': {
              example: {
                error: 'Konfigurasi pajak tidak ditemukan',
              },
            },
          },
        },
        422: {
          description: 'Validation error - invalid variant ID',
          content: {
            'application/json': {
              example: {
                error: 'Validation error',
              },
            },
          },
        },
      },
    },
  })

  .patch('/product-taxes/:id', async ({ params, body, set, headers }) => {
    const authHeader = headers['authorization'] || headers['Authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    const token = authHeader.substring(7);

    try {
      await getUserIdFromToken(token);

      // Check if at least one field is provided
      if (body.tax_code === undefined && body.is_inclusive === undefined) {
        set.status = 422;
        return { error: 'At least one field must be provided' };
      }

      const result = await updateProductTax(parseInt(params.id), body);
      return { data: result };
    } catch (error: any) {
      if (error.message === 'Unauthorized') {
        set.status = 401;
        return { error: 'Unauthorized' };
      }
      if (error.message === 'Konfigurasi pajak tidak ditemukan') {
        set.status = 404;
        return { error: error.message };
      }
      throw error;
    }
  }, {
    params: t.Object({
      id: t.Number(),
    }),
    body: t.Object({
      tax_code: t.Optional(t.Union([t.String({ maxLength: 20 }), t.Null()])),
      is_inclusive: t.Optional(t.Boolean()),
    }),
    detail: {
      summary: 'Update tax configuration',
      tags: ['Product Taxes'],
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            example: {
              tax_code: 'PPN-12',
              is_inclusive: true,
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Tax configuration updated successfully',
          content: {
            'application/json': {
              example: {
                data: {
                  id: 1,
                  variant_id: 1,
                  tax_code: 'PPN-12',
                  is_inclusive: true,
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
          description: 'Tax configuration not found',
          content: {
            'application/json': {
              example: {
                error: 'Konfigurasi pajak tidak ditemukan',
              },
            },
          },
        },
        422: {
          description: 'Validation error - empty body or invalid data',
          content: {
            'application/json': {
              example: {
                error: 'Validation error',
              },
            },
          },
        },
      },
    },
  })

  .delete('/product-taxes/:id', async ({ params, set, headers }) => {
    const authHeader = headers['authorization'] || headers['Authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    const token = authHeader.substring(7);

    try {
      await getUserIdFromToken(token);

      await deleteProductTax(parseInt(params.id));
      return { data: 'OK' };
    } catch (error: any) {
      if (error.message === 'Unauthorized') {
        set.status = 401;
        return { error: 'Unauthorized' };
      }
      if (error.message === 'Konfigurasi pajak tidak ditemukan') {
        set.status = 404;
        return { error: error.message };
      }
      throw error;
    }
  }, {
    params: t.Object({
      id: t.Number(),
    }),
    detail: {
      summary: 'Delete tax configuration',
      tags: ['Product Taxes'],
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Tax configuration deleted successfully',
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
          description: 'Tax configuration not found',
          content: {
            'application/json': {
              example: {
                error: 'Konfigurasi pajak tidak ditemukan',
              },
            },
          },
        },
        422: {
          description: 'Validation error - invalid ID',
          content: {
            'application/json': {
              example: {
                error: 'Validation error',
              },
            },
          },
        },
      },
    },
  });