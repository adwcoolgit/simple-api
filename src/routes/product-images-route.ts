import { Elysia, t } from 'elysia';
import {
  addProductImages,
  getImagesByVariant,
  getPrimaryImage,
  setPrimaryImage,
  deleteProductImage,
} from '../service/product-images-service';

const bearerAuth = ({ headers }: { headers: Record<string, string | undefined> }) => {
  const authHeader = headers['authorization'] || headers['Authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }

  const token = authHeader.substring(7);

  if (!token || token !== 'test-token') {
    throw new Error('Unauthorized');
  }

  return { token };
};

export const productImagesRoute = new Elysia({ prefix: '/api/product-images', tags: ['Product Images'] })
  .post('/', async ({ body, set, headers }: any) => {
    try {
      bearerAuth({ headers });
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
      if (error instanceof Error) {
        if (error.message === 'Unauthorized') {
          set.status = 401;
          return { error: 'Unauthorized' };
        }
        if (error.message === 'Images must not be empty' || error.message === 'Exactly one image must be set as primary' || error.message === 'Variant tidak ditemukan') {
          set.status = 422;
          return { error: error.message };
        }
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
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['variant_id', 'images'],
              properties: {
                variant_id: {
                  type: 'number',
                  description: 'The ID of the product variant',
                  example: 1,
                },
                images: {
                  type: 'array',
                  description: 'Array of images to add',
                  items: {
                    type: 'object',
                    required: ['image_url', 'is_primary'],
                    properties: {
                      image_url: {
                        type: 'string',
                        format: 'uri',
                        description: 'URL of the product image',
                        example: 'https://example.com/images/product-main.jpg',
                      },
                      is_primary: {
                        type: 'boolean',
                        description: 'Whether this is the primary image for the variant',
                        example: true,
                      },
                    },
                  },
                  example: [
                    {
                      image_url: 'https://example.com/images/product-main.jpg',
                      is_primary: true,
                    },
                    {
                      image_url: 'https://example.com/images/product-side.jpg',
                      is_primary: false,
                    },
                  ],
                },
              },
            },
          },
        },
      },
      responses: {
        201: {
          description: 'Images added successfully',
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
        422: {
          description: 'Validation error',
          content: {
            'application/json': {
              example: {
                error: 'Images must not be empty',
              },
            },
          },
        },
      },
    },
  })

  .get('/:variantId', async ({ params, set, headers }: any) => {
    try {
      bearerAuth({ headers });
      const result = await getImagesByVariant(params.variantId);
      return { data: result };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Unauthorized') {
          set.status = 401;
          return { error: 'Unauthorized' };
        }
        if (error.message === 'Variant tidak ditemukan') {
          set.status = 404;
          return { error: 'Variant tidak ditemukan' };
        }
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

  .get('/:variantId/current', async ({ params, set, headers }: any) => {
    try {
      bearerAuth({ headers });
      const result = await getPrimaryImage(params.variantId);
      return { data: result };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Unauthorized') {
          set.status = 401;
          return { error: 'Unauthorized' };
        }
        if (error.message === 'Variant tidak ditemukan' || error.message === 'Gambar primary tidak ditemukan') {
          set.status = 404;
          return { error: error.message };
        }
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

  .patch('/:imageId/primary', async ({ params, body, set, headers }: any) => {
    try {
      bearerAuth({ headers });
      const result = await setPrimaryImage(params.imageId, body.variant_id);
      return { data: result };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Unauthorized') {
          set.status = 401;
          return { error: 'Unauthorized' };
        }
        if (error.message === 'Image not found') {
          set.status = 404;
          return { error: 'Image not found' };
        }
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
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['variant_id'],
              properties: {
                variant_id: {
                  type: 'number',
                  description: 'The ID of the product variant to which the image belongs',
                  example: 1,
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Primary image set successfully',
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
          description: 'Image not found',
          content: {
            'application/json': {
              example: {
                error: 'Image not found',
              },
            },
          },
        },
      },
    },
  })

  .delete('/:imageId', async ({ params, set, headers }: any) => {
    try {
      bearerAuth({ headers });
      const result = await deleteProductImage(params.imageId);
      return { data: result };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Unauthorized') {
          set.status = 401;
          return { error: 'Unauthorized' };
        }
        if (error.message === 'Image not found') {
          set.status = 404;
          return { error: 'Image not found' };
        }
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
          description: 'Image not found',
          content: {
            'application/json': {
              example: {
                error: 'Image not found',
              },
            },
          },
        },
      },
    },
  });