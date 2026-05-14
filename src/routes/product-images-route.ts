import { Elysia, t } from 'elysia';
import {
  addProductImages,
  getImagesByVariant,
  getPrimaryImage,
  setPrimaryImage,
  deleteProductImage,
} from '../service/product-images-service';

const authMiddleware = ({ headers }: { headers: Record<string, string | undefined> }) => {
  const authHeader = headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Unauthorized' };
  }

  const token = authHeader.substring(7);
  if (!token || token !== 'test-token') {
    return { error: 'Unauthorized' };
  }

  return { token };
};

export const productImagesRoute = new Elysia({ prefix: '/api/product-images', tags: ['Product Images'] })
  .derive(authMiddleware)
  .post('/', async ({ auth, body, set }) => {
    if (auth.error) {
      set.status = 401;
      return { error: auth.error };
    }
    try {
      const result = await addProductImages({
        variantId: body.variant_id,
        images: body.images.map((img: any) => ({
          imageUrl: img.image_url,
          isPrimary: img.is_primary,
        })),
      });
      set.status = 201;
      return { data: result };
    } catch (error) {
      if (error instanceof Error && (error.message === 'Images must not be empty' || error.message === 'Exactly one image must be set as primary' || error.message === 'Variant tidak ditemukan')) {
        set.status = 422;
        return { error: error.message };
      }
      set.status = 404;
      return { error: 'Variant tidak ditemukan' };
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
      responses: {
        201: {
          description: 'Images added successfully',
        },
        401: {
          description: 'Unauthorized',
        },
        422: {
          description: 'Validation error',
        },
      },
    },
  })

  .get('/:variantId', async ({ auth, params, set }) => {
    if (auth.error) {
      set.status = 401;
      return { error: auth.error };
    }
    try {
      const result = await getImagesByVariant(params.variantId);
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
      summary: 'Get all images for a product variant',
      tags: ['Product Images'],
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Images retrieved successfully',
        },
        401: {
          description: 'Unauthorized',
        },
        404: {
          description: 'Variant not found',
        },
      },
    },
  })

  .get('/:variantId/current', async ({ auth, params, set }) => {
    if (auth.error) {
      set.status = 401;
      return { error: auth.error };
    }
    try {
      const result = await getPrimaryImage(params.variantId);
      return { data: result };
    } catch (error) {
      set.status = 404;
      return { error: 'Gambar primary tidak ditemukan' };
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
        },
        401: {
          description: 'Unauthorized',
        },
        404: {
          description: 'Variant not found or no primary image',
        },
      },
    },
  })

  .patch('/:imageId/primary', async ({ auth, params, body, set }) => {
    if (auth.error) {
      set.status = 401;
      return { error: auth.error };
    }
    try {
      const result = await setPrimaryImage(params.imageId, body.variant_id);
      return { data: result };
    } catch (error) {
      if (error instanceof Error && error.message === 'Image not found') {
        set.status = 404;
        return { error: 'Image not found' };
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
      responses: {
        200: {
          description: 'Primary image set successfully',
        },
        401: {
          description: 'Unauthorized',
        },
        404: {
          description: 'Image not found',
        },
      },
    },
  })

  .delete('/:imageId', async ({ auth, params, set }) => {
    if (auth.error) {
      set.status = 401;
      return { error: auth.error };
    }
    try {
      const result = await deleteProductImage(params.imageId);
      return { data: result };
    } catch (error) {
      if (error instanceof Error && error.message === 'Image not found') {
        set.status = 404;
        return { error: 'Image not found' };
      }
      throw error;
    }
  }, {
    params: t.Object({
      imageId: t.Number(),
    }),
    detail: {
      summary: 'Delete a product image',
      responses: {
        200: {
          description: 'Image deleted successfully',
        },
        401: {
          description: 'Unauthorized',
        },
        404: {
          description: 'Image not found',
        },
      },
    },
  });