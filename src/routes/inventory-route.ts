import { Elysia, t } from 'elysia';
import {
  createInventory as createInventorySvc,
  getInventoryList as getInventoryListSvc,
  getInventoryDetail as getInventoryDetailSvc,
  updateInventorySettings as updateInventorySettingsSvc,
  adjustStock as adjustStockSvc,
  reserveStock as reserveStockSvc,
  releaseStock as releaseStockSvc,
  deleteInventory as deleteInventorySvc,
  type CreateInventoryInput,
  type UpdateInventorySettingsInput,
  type AdjustStockInput,
  type ReserveStockInput,
  type ReleaseStockInput,
  type InventoryFilters,
} from '../service/inventory-service';
import { bearerAuth } from './auth-middleware';

const createInventoryRoute = new Elysia().post(
  '/api/inventory',
  async ({ body, set, headers }: any) => {
    const authHeader = headers['authorization'] || headers['Authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    try {
      const result = await createInventorySvc(body);
      set.status = 201;
      return { data: result };
    } catch (err: any) {
      if (err.message === 'Unauthorized') {
        set.status = 401;
        return { error: 'Unauthorized' };
      }
      if (
        err.message ===
        'The inventory for this variant and warehouse already exists'
      ) {
        set.status = 409;
        return { error: err.message };
      }
      if (
        err.message.includes('not found') ||
        err.message.includes('must be less than')
      ) {
        set.status = 422;
        return { error: err.message };
      }
      throw err;
    }
  },
  {
    body: t.Object({
      variant_id: t.Number({ minimum: 1 }),
      warehouse_id: t.Number({ minimum: 1 }),
      stock_qty: t.Optional(t.Number({ minimum: 0 })),
      reserved_qty: t.Optional(t.Number({ minimum: 0 })),
      min_stock: t.Optional(t.Number({ minimum: 0 })),
      max_stock: t.Optional(t.Number({ minimum: 0 })),
    }),
    detail: {
      summary: 'Create new inventory record',
      tags: ['Inventory'],
      security: [{ bearerAuth: [] }],
      responses: {
        201: {
          description: 'Inventory created successfully',
          content: {
            'application/json': {
              example: {
                data: {
                  id: 1,
                  variant_id: 1,
                  warehouse_id: 2,
                  stock_qty: '100.00',
                  reserved_qty: '0.00',
                  available_qty: '100.00',
                  min_stock: '10.00',
                  max_stock: '500.00',
                },
              },
            },
          },
        },
        409: {
          description:
            'Inventory for this variant and warehouse already exists',
          content: {
            'application/json': {
              example: {
                error:
                  'The inventory for this variant and warehouse already exists',
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

const listInventoryRoute = new Elysia().get(
  '/api/inventory',
  async ({ query, set, headers }: any) => {
    const authHeader = headers['authorization'] || headers['Authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    const filters: InventoryFilters = {};
    if (query.warehouse_id) filters.warehouse_id = parseInt(query.warehouse_id);
    if (query.variant_id) filters.variant_id = parseInt(query.variant_id);
    if (query.low_stock === 'true') filters.low_stock = true;

    try {
      const result = await getInventoryListSvc(filters);
      return { data: result };
    } catch (err: any) {
      if (err.message === 'Unauthorized') {
        set.status = 401;
        return { error: 'Unauthorized' };
      }
      throw err;
    }
  },
  {
    query: t.Object({
      warehouse_id: t.Optional(t.String()),
      variant_id: t.Optional(t.String()),
      low_stock: t.Optional(t.String()),
    }),
    detail: {
      summary: 'List all inventory records',
      tags: ['Inventory'],
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Inventory list retrieved successfully',
          content: {
            'application/json': {
              example: {
                data: [
                  {
                    id: 1,
                    variant_id: 1,
                    warehouse_id: 2,
                    stock_qty: '100.00',
                    reserved_qty: '0.00',
                    available_qty: '100.00',
                    min_stock: '10.00',
                    max_stock: '500.00',
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

const getInventoryDetailRt = new Elysia().get(
  '/api/inventory/:variantId/:warehouseId',
  async ({ params, set, headers }: any) => {
    const authHeader = headers['authorization'] || headers['Authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    const variantId = parseInt(params.variantId);
    const warehouseId = parseInt(params.warehouseId);

    if (
      isNaN(variantId) ||
      variantId <= 0 ||
      isNaN(warehouseId) ||
      warehouseId <= 0
    ) {
      set.status = 422;
      return { error: 'Invalid parameters' };
    }

    try {
      const result = await getInventoryDetailSvc(variantId, warehouseId);
      return { data: result };
    } catch (err: any) {
      if (err.message.includes('Inventory not found')) {
        set.status = 404;
        return { error: err.message };
      }
      throw err;
    }
  },
  {
    params: t.Object({
      variantId: t.String(),
      warehouseId: t.String(),
    }),
    detail: {
      summary: 'Get inventory detail by variant and warehouse ID',
      tags: ['Inventory'],
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Inventory detail retrieved successfully',
          content: {
            'application/json': {
              example: {
                data: {
                  id: 1,
                  variant_id: 1,
                  warehouse_id: 2,
                  stock_qty: '100.00',
                  reserved_qty: '0.00',
                  available_qty: '100.00',
                  min_stock: '10.00',
                  max_stock: '500.00',
                },
              },
            },
          },
        },
        404: {
          description: 'Inventory not found',
          content: {
            'application/json': {
              example: {
                error: 'Inventory not found',
              },
            },
          },
        },
      },
    },
  }
);

const updateInventorySettingsRoute = new Elysia().patch(
  '/api/inventory/:variantId/:warehouseId',
  async ({ params, body, set, headers }: any) => {
    const authHeader = headers['authorization'] || headers['Authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    // Check if at least one field is provided
    if (!body.min_stock && !body.max_stock) {
      set.status = 422;
      return { error: 'At least one field must be provided' };
    }

    const variantId = parseInt(params.variantId);
    const warehouseId = parseInt(params.warehouseId);

    if (
      isNaN(variantId) ||
      variantId <= 0 ||
      isNaN(warehouseId) ||
      warehouseId <= 0
    ) {
      set.status = 422;
      return { error: 'Invalid parameters' };
    }

    try {
      const result = await updateInventorySettingsSvc(
        variantId,
        warehouseId,
        body
      );
      return { data: result };
    } catch (err: any) {
      if (err.message.includes('Inventory not found')) {
        set.status = 404;
        return { error: err.message };
      }
      if (
        err.message.includes('Minimum stock must be less than maximum stock')
      ) {
        set.status = 422;
        return { error: err.message };
      }
      throw err;
    }
  },
  {
    params: t.Object({
      variantId: t.String(),
      warehouseId: t.String(),
    }),
    body: t.Object({
      min_stock: t.Optional(t.Number({ minimum: 0 })),
      max_stock: t.Optional(t.Number({ minimum: 0 })),
    }),
    detail: {
      summary: 'Update inventory stock settings (min/max stock)',
      tags: ['Inventory'],
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Inventory settings updated successfully',
          content: {
            'application/json': {
              example: {
                data: 'OK',
              },
            },
          },
        },
        404: {
          description: 'Inventory not found',
          content: {
            'application/json': {
              example: {
                error: 'Inventory not found',
              },
            },
          },
        },
      },
    },
  }
);

const adjustStockRoute = new Elysia().post(
  '/api/inventory/:variantId/:warehouseId/adjust',
  async ({ params, body, set, headers }: any) => {
    const authHeader = headers['authorization'] || headers['Authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    const variantId = parseInt(params.variantId);
    const warehouseId = parseInt(params.warehouseId);

    if (
      isNaN(variantId) ||
      variantId <= 0 ||
      isNaN(warehouseId) ||
      warehouseId <= 0
    ) {
      set.status = 422;
      return { error: 'Invalid parameters' };
    }

    try {
      const result = await adjustStockSvc(variantId, warehouseId, body);
      return { data: result };
    } catch (err: any) {
      if (err.message.includes('Inventory not found')) {
        set.status = 404;
        return { error: err.message };
      }
      if (
        err.message.includes('Insufficient stock') ||
        err.message.includes('Stock cannot be less than the reserved amount') ||
        err.message.includes('Adjustment quantity cannot be zero')
      ) {
        set.status = 422;
        return { error: err.message };
      }
      throw err;
    }
  },
  {
    params: t.Object({
      variantId: t.String(),
      warehouseId: t.String(),
    }),
    body: t.Object({
      qty: t.Number({ not: 0 }),
      note: t.Optional(t.String()),
    }),
    detail: {
      summary: 'Adjust inventory stock quantity',
      tags: ['Inventory'],
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Stock adjusted successfully',
          content: {
            'application/json': {
              example: {
                data: {
                  stock_qty: '90.00',
                  available_qty: '90.00',
                },
              },
            },
          },
        },
        404: {
          description: 'Inventory not found',
          content: {
            'application/json': {
              example: {
                error: 'Inventory not found',
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

const reserveStockRoute = new Elysia().post(
  '/api/inventory/:variantId/:warehouseId/reserve',
  async ({ params, body, set, headers }: any) => {
    const authHeader = headers['authorization'] || headers['Authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    const variantId = parseInt(params.variantId);
    const warehouseId = parseInt(params.warehouseId);

    if (
      isNaN(variantId) ||
      variantId <= 0 ||
      isNaN(warehouseId) ||
      warehouseId <= 0
    ) {
      set.status = 422;
      return { error: 'Invalid parameters' };
    }

    try {
      const result = await reserveStockSvc(variantId, warehouseId, body);
      return { data: result };
    } catch (err: any) {
      if (err.message.includes('Inventory not found')) {
        set.status = 404;
        return { error: err.message };
      }
      if (err.message.includes('Insufficient stock for reservation')) {
        set.status = 422;
        return { error: err.message };
      }
      throw err;
    }
  },
  {
    params: t.Object({
      variantId: t.String(),
      warehouseId: t.String(),
    }),
    body: t.Object({
      qty: t.Number({ minimum: 0.01 }),
    }),
    detail: {
      summary: 'Reserve inventory stock',
      tags: ['Inventory'],
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Stock reserved successfully',
          content: {
            'application/json': {
              example: {
                data: {
                  reserved_qty: '5.00',
                  available_qty: '95.00',
                },
              },
            },
          },
        },
        404: {
          description: 'Inventory not found',
          content: {
            'application/json': {
              example: {
                error: 'Inventory not found',
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

const releaseStockRoute = new Elysia().post(
  '/api/inventory/:variantId/:warehouseId/release',
  async ({ params, body, set, headers }: any) => {
    const authHeader = headers['authorization'] || headers['Authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    const variantId = parseInt(params.variantId);
    const warehouseId = parseInt(params.warehouseId);

    if (
      isNaN(variantId) ||
      variantId <= 0 ||
      isNaN(warehouseId) ||
      warehouseId <= 0
    ) {
      set.status = 422;
      return { error: 'Invalid parameters' };
    }

    try {
      const result = await releaseStockSvc(variantId, warehouseId, body);
      return { data: result };
    } catch (err: any) {
      if (err.message.includes('Inventory not found')) {
        set.status = 404;
        return { error: err.message };
      }
      if (err.message.includes('Release quantity exceeds the reserved amount')) {
        set.status = 422;
        return { error: err.message };
      }
      throw err;
    }
  },
  {
    params: t.Object({
      variantId: t.String(),
      warehouseId: t.String(),
    }),
    body: t.Object({
      qty: t.Number({ minimum: 0.01 }),
    }),
    detail: {
      summary: 'Release reserved inventory stock',
      tags: ['Inventory'],
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Stock reservation released successfully',
          content: {
            'application/json': {
              example: {
                data: {
                  reserved_qty: '0.00',
                  available_qty: '100.00',
                },
              },
            },
          },
        },
        404: {
          description: 'Inventory not found',
          content: {
            'application/json': {
              example: {
                error: 'Inventory not found',
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

const deleteInventoryRoute = new Elysia().delete(
  '/api/inventory/:variantId/:warehouseId',
  async ({ params, set, headers }: any) => {
    const authHeader = headers['authorization'] || headers['Authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    const variantId = parseInt(params.variantId);
    const warehouseId = parseInt(params.warehouseId);

    if (
      isNaN(variantId) ||
      variantId <= 0 ||
      isNaN(warehouseId) ||
      warehouseId <= 0
    ) {
      set.status = 422;
      return { error: 'Invalid parameters' };
    }

    try {
      const result = await deleteInventorySvc(variantId, warehouseId);
      return { data: result };
    } catch (err: any) {
      if (err.message.includes('Inventory not found')) {
        set.status = 404;
        return { error: err.message };
      }
      if (
        err.message.includes('Cannot delete inventory with active reservations')
      ) {
        set.status = 422;
        return { error: err.message };
      }
      throw err;
    }
  },
  {
    params: t.Object({
      variantId: t.String(),
      warehouseId: t.String(),
    }),
    detail: {
      summary: 'Delete inventory record',
      tags: ['Inventory'],
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Inventory deleted successfully',
          content: {
            'application/json': {
              example: {
                data: 'OK',
              },
            },
          },
        },
        404: {
          description: 'Inventory not found',
          content: {
            'application/json': {
              example: {
                error: 'Inventory not found',
              },
            },
          },
        },
        422: {
          description: 'Cannot delete inventory with active reservations',
          content: {
            'application/json': {
              example: {
                error: 'Cannot delete inventory with active reservations',
              },
            },
          },
        },
      },
    },
  }
);

// Export individual routes for better swagger detection
export const createInventory = createInventoryRoute;
export const listInventory = listInventoryRoute;
export const getInventoryDetail = getInventoryDetailRt;
export const updateInventorySettings = updateInventorySettingsRoute;
export const adjustStock = adjustStockRoute;
export const reserveStock = reserveStockRoute;
export const releaseStock = releaseStockRoute;
export const deleteInventory = deleteInventoryRoute;
