import { Elysia, t } from 'elysia';
import {
  addProductImages,
  getImagesByVariant,
  getPrimaryImage,
  setPrimaryImage,
  deleteProductImage,
} from '../service/product-images-service';
import { getUserIdFromToken } from './auth-middleware';



export const productImagesRoute = new Elysia({ prefix: '/api', tags: ['Product Images'] })
  .onError(({ error, set }) => {
    if (error instanceof Error && error.name === 'ValidationError') {
      set.status = 422;
      return { error: 'Validation error' };
    }
  })
  .post('/product-images', async ({ body, set, headers }) => {
    const authHeader = headers['authorization'] || headers['Authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    const token = authHeader.substring(7);

    try {
      await getUserIdFromToken(token);

      const result = await addProductImages({
        variantId: body.variant_id,
        images: body.images.map((img: any) => ({
          imageUrl: img.image_url,
          isPrimary: img.is_primary,
        })),
      });
      set.status = 201;
      return { data: result };
    } catch (error: any) {
      if (error.message === 'Unauthorized') {
        set.status = 401;
        return { error: 'Unauthorized' };
      }
      if (error.message === 'Images must not be empty' || error.message === 'Exactly one image must be set as primary' || error.message === 'Variant tidak ditemukan') {
        set.status = 422;
        return { error: error.message };
      }
      throw error;
    }
  }, {
    body: t.Object({
      variant_id: t.Number(),
      images: t.Array(t.Object({
        image_url: t.String(),
        is_primary: t.Boolean(),
      })),
    }),
    detail: {
      summary: 'Add multiple product images',
    },
  })

  .get('/product-images/:variantId', async ({ params, set, headers }) => {
    const authHeader = headers['authorization'] || headers['Authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    const token = authHeader.substring(7);

    try {
      await getUserIdFromToken(token);

      const result = await getImagesByVariant(params.variantId);
      return { data: result };
    } catch (error: any) {
      if (error.message === 'Unauthorized') {
        set.status = 401;
        return { error: 'Unauthorized' };
      }
      if (error.message === 'Variant tidak ditemukan') {
        set.status = 404;
        return { error: 'Variant tidak ditemukan' };
      }
      throw error;
    }
  }, {
    params: t.Object({
      variantId: t.Number(),
    }),
    detail: {
      summary: 'Get all images for a product variant',
      tags: ['Product Images'],
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Images retrieved successfully',
          content: {
            'application/json': {
              example: {
                data: [
                  {
                    id: 1,
                    variant_id: 1,
                    image_url: 'https://example.com/images/product-main.jpg',
                    is_primary: true,
                  },
                  {
                    id: 2,
                    variant_id: 1,
                    image_url: 'https://example.com/images/product-side.jpg',
                    is_primary: false,
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

  .get('/product-images/:variantId/current', async ({ params, set, headers }) => {
    const authHeader = headers['authorization'] || headers['Authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    const token = authHeader.substring(7);

    try {
      await getUserIdFromToken(token);

      const result = await getPrimaryImage(params.variantId);
      return { data: result };
    } catch (error: any) {
      if (error.message === 'Unauthorized') {
        set.status = 401;
        return { error: 'Unauthorized' };
      }
      if (error.message === 'Variant tidak ditemukan' || error.message === 'Gambar primary tidak ditemukan') {
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
      summary: 'Get the primary image for a product variant',
      tags: ['Product Images'],
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Primary image retrieved successfully',
          content: {
            'application/json': {
              example: {
                data: {
                  id: 1,
                  variant_id: 1,
                  image_url: 'https://example.com/images/product-main.jpg',
                  is_primary: true,
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
          description: 'Variant not found or no primary image',
          content: {
            'application/json': {
              example: {
                error: 'Gambar primary tidak ditemukan',
              },
            },
          },
        },
      },
    },
  })

  .patch('/product-images/:imageId/primary', async ({ params, body, set, headers }) => {
    const authHeader = headers['authorization'] || headers['Authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    const token = authHeader.substring(7);

    try {
      await getUserIdFromToken(token);

      const result = await setPrimaryImage(params.imageId, body.variant_id);
      return { data: result };
    } catch (error: any) {
      if (error.message === 'Unauthorized') {
        set.status = 401;
        return { error: 'Unauthorized' };
      }
      if (error.message === 'Gambar tidak ditemukan') {
        set.status = 404;
        return { error: 'Gambar tidak ditemukan' };
      }
      throw error;
    }
  }, {
    params: t.Object({
      imageId: t.Number(),
    }),
    body: t.Object({
      variant_id: t.Number(),
    }),
    detail: {
      summary: 'Set an image as primary for its variant',
    },
  })

  .delete('/product-images/:imageId', async ({ params, set, headers }) => {
    const authHeader = headers['authorization'] || headers['Authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    const token = authHeader.substring(7);

    try {
      await getUserIdFromToken(token);

      const result = await deleteProductImage(params.imageId);
      return { data: result };
    } catch (error: any) {
      if (error.message === 'Unauthorized') {
        set.status = 401;
        return { error: 'Unauthorized' };
      }
      if (error.message === 'Gambar tidak ditemukan') {
        set.status = 404;
        return { error: 'Gambar tidak ditemukan' };
      }
      throw error;
    }
  }, {
    params: t.Object({
      imageId: t.Number(),
    }),
    detail: {
      summary: 'Delete a product image',
    },
  });