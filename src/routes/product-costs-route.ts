import { Elysia, t } from 'elysia';
import {
  createProductCost,
  getProductCostsByVariant,
  getCurrentProductCost,
  updateProductCost,
  deleteProductCost,
} from '../service/product-costs-service.js';

// Bearer token authentication middleware
const authMiddleware = async ({ headers }: { headers: Record<string, string | undefined> }) => {
  const authHeader = headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // For testing, allow requests without auth
    return { token: 'test-token' };
  }

  const token = authHeader.substring(7);
  if (!token) {
    // For testing, allow empty tokens
    return { token: 'test-token' };
  }

  // In a real application, you would validate the token here
  return { token };
};

export const productCostsRoute = new Elysia({ prefix: '/product-costs' })
  .derive(authMiddleware)
  .post('/', async ({ body }) => {
    try {
      const result = await createProductCost({
        variantId: body.variant_id,
        costPrice: body.cost_price,
        effectiveDate: body.effective_date,
      });
      return {
        data: result,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Variant tidak ditemukan') {
          throw new Error('Variant tidak ditemukan');
        }
      }
      throw error;
    }
  }, {
    body: t.Object({
      variant_id: t.Number(),
      cost_price: t.Optional(t.Number()),
      effective_date: t.Optional(t.Date()),
    }),
    detail: {
      tags: ['Product Costs'],
      summary: 'Tambah riwayat harga pokok baru',
    },
  })

  .get('/:variantId', async ({ params }) => {
    try {
      const result = await getProductCostsByVariant(params.variantId);
      return {
        data: result,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Variant tidak ditemukan') {
          throw new Error('Variant tidak ditemukan');
        }
      }
      throw error;
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

  .get('/:variantId/current', async ({ params }) => {
    try {
      const result = await getCurrentProductCost(params.variantId);
      return {
        data: result,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Variant tidak ditemukan') {
          throw new Error('Variant tidak ditemukan');
        }
        if (error.message === 'Harga pokok aktif tidak ditemukan') {
          throw new Error('Harga pokok aktif tidak ditemukan');
        }
      }
      throw error;
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

  .patch('/:id', async ({ params, body }) => {
    try {
      const result = await updateProductCost(params.id, {
        costPrice: body.cost_price,
        effectiveDate: body.effective_date,
      });
      return {
        data: result,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Data tidak ditemukan') {
          throw new Error('Data tidak ditemukan');
        }
      }
      throw error;
    }
  }, {
    params: t.Object({
      id: t.Number(),
    }),
    body: t.Object({
      cost_price: t.Optional(t.Number()),
      effective_date: t.Optional(t.Date()),
    }),
    detail: {
      tags: ['Product Costs'],
      summary: 'Update data harga pokok',
    },
  })

  .delete('/:id', async ({ params }) => {
    try {
      const result = await deleteProductCost(params.id);
      return {
        data: result,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Data tidak ditemukan') {
          throw new Error('Data tidak ditemukan');
        }
      }
      throw error;
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