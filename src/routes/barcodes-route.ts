import { Elysia, t } from 'elysia';
import {
  createBarcode,
  getBarcodesByVariant,
  getBarcodeById,
  deleteBarcode,
} from '../service/barcodes-service';
import { getUserIdFromToken } from './auth-middleware';

export const barcodesRoute = new Elysia({ prefix: '/api', tags: ['Barcodes'] })
  .onError(({ error, set }) => {
    if (error instanceof Error && error.name === 'ValidationError') {
      set.status = 422;
      return { error: 'Validation error' };
    }
  })
  .post(
    '/barcodes',
    async ({ body, set, headers }) => {
      const authHeader = headers['authorization'] || headers['Authorization'];

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const token = authHeader.substring(7);

      try {
        await getUserIdFromToken(token);

        const result = await createBarcode({
          variantId: body.variant_id,
          barcode: body.barcode,
        });
        set.status = 201;
        return { data: result };
      } catch (error: any) {
        if (error.message === 'Unauthorized') {
          set.status = 401;
          return { error: 'Unauthorized' };
        }
        if (error.message === 'Variant not found') {
          set.status = 404;
          return { error: error.message };
        }
        if (error.message === 'Barcode already in use') {
          set.status = 409;
          return { error: error.message };
        }
        throw error;
      }
    },
    {
      body: t.Object({
        variant_id: t.Number(),
        barcode: t.String({ maxLength: 50 }),
      }),
      detail: {
        summary: 'Create a new barcode',
        tags: ['Barcodes'],
      },
    }
  )

  .get(
    '/barcodes/variant/:variantId',
    async ({ params, set, headers }) => {
      const authHeader = headers['authorization'] || headers['Authorization'];

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const token = authHeader.substring(7);

      try {
        await getUserIdFromToken(token);

        const result = await getBarcodesByVariant(params.variantId);
        return { data: result };
      } catch (error: any) {
        if (error.message === 'Unauthorized') {
          set.status = 401;
          return { error: 'Unauthorized' };
        }
        if (error.message === 'Variant not found') {
          set.status = 404;
          return { error: error.message };
        }
        throw error;
      }
    },
    {
      params: t.Object({
        variantId: t.Number(),
      }),
      detail: {
        summary: 'Get all barcodes for a variant',
        tags: ['Barcodes'],
      },
    }
  )

  .get(
    '/barcodes/:id',
    async ({ params, set, headers }) => {
      const authHeader = headers['authorization'] || headers['Authorization'];

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const token = authHeader.substring(7);

      try {
        await getUserIdFromToken(token);

        const result = await getBarcodeById(params.id);
        return { data: result };
      } catch (error: any) {
        if (error.message === 'Unauthorized') {
          set.status = 401;
          return { error: 'Unauthorized' };
        }
        if (error.message === 'Barcode not found') {
          set.status = 404;
          return { error: error.message };
        }
        throw error;
      }
    },
    {
      params: t.Object({
        id: t.Number(),
      }),
      detail: {
        summary: 'Get a barcode by ID',
        tags: ['Barcodes'],
      },
    }
  )

  .delete(
    '/barcodes/:id',
    async ({ params, set, headers }) => {
      const authHeader = headers['authorization'] || headers['Authorization'];

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const token = authHeader.substring(7);

      try {
        await getUserIdFromToken(token);

        const result = await deleteBarcode(params.id);
        return { data: result };
      } catch (error: any) {
        if (error.message === 'Unauthorized') {
          set.status = 401;
          return { error: 'Unauthorized' };
        }
        if (error.message === 'Barcode not found') {
          set.status = 404;
          return { error: error.message };
        }
        throw error;
      }
    },
    {
      params: t.Object({
        id: t.Number(),
      }),
      detail: {
        summary: 'Delete a barcode',
        tags: ['Barcodes'],
      },
    }
  );
