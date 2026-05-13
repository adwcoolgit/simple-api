import { Elysia, t } from 'elysia';
import {
  createProductCost,
  getProductCostsByVariant,
  getCurrentProductCost,
  updateProductCost,
  deleteProductCost,
} from '../service/product-costs-service.js';

// Bearer token authentication middleware
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

export const productCostsRoute = new Elysia({ prefix: '/product-costs' })
  .derive(authMiddleware)
  .post('/', async ({ auth, body, set }) => {
    if (auth.error) {
      set.status = 401;
      return { error: auth.error };
    }
    try {
      if (body.cost_price == null) throw new Error('cost_price is required');
      if (body.effective_date == null) throw new Error('effective_date is required');
      if (body.cost_price < 0) throw new Error('cost_price must be non-negative');
      const result = await createProductCost({
        variantId: body.variant_id,
        costPrice: body.cost_price,
        effectiveDate: body.effective_date,
      });
      set.status = 201;
      return { data: result };
    } catch (error) {
      if (error instanceof Error && (error.message === 'cost_price is required' || error.message === 'effective_date is required' || error.message === 'cost_price must be non-negative')) {
        set.status = 422;
        return { error: error.message };
      }
      set.status = 404;
      return { error: 'Variant tidak ditemukan' };
    }
  }, {
    body: t.Object({
      variant_id: t.Number(),
      cost_price: t.Number({ minimum: 0 }),
      effective_date: t.Date(),
    }),
    detail: {
      tags: ['Product Costs'],
      summary: 'Tambah riwayat harga pokok baru',
    },
  })

  .get('/:variantId', async ({ auth, params, set }) => {
    if (auth.error) {
      set.status = 401;
      return { error: auth.error };
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
      tags: ['Product Costs'],
      summary: 'Ambil semua riwayat harga pokok per varian',
    },
  })

  .get('/:variantId/current', async ({ auth, params, set }) => {
    if (auth.error) {
      set.status = 401;
      return { error: auth.error };
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
      tags: ['Product Costs'],
      summary: 'Ambil harga pokok yang sedang aktif',
    },
  })

  .patch('/:id', async ({ auth, params, body, set }) => {
    if (auth.error) {
      set.status = 401;
      return { error: auth.error };
    }
    try {
      if (!body.cost_price && !body.effective_date) throw new Error('At least one field must be provided');
      if (body.cost_price != null && body.cost_price < 0) throw new Error('cost_price must be non-negative');
      const result = await updateProductCost(params.id, {
        costPrice: body.cost_price,
        effectiveDate: body.effective_date,
      });
      return { data: result };
    } catch (error) {
      if (error instanceof Error && (error.message === 'At least one field must be provided' || error.message === 'cost_price must be non-negative')) {
        set.status = 422;
        return { error: error.message };
      }
      set.status = 404;
      return { error: 'Data tidak ditemukan' };
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
      tags: ['Product Costs'],
      summary: 'Update data harga pokok',
    },
  })

  .delete('/:id', async ({ auth, params, set }) => {
    if (auth.error) {
      set.status = 401;
      return { error: auth.error };
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
      tags: ['Product Costs'],
      summary: 'Hapus data harga pokok',
    },
  });