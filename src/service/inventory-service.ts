import { inventory, warehouses, productVariants } from '../db/schema';
import { db, dbRead } from '../db';
import { eq, and, sql, gte, lte } from 'drizzle-orm';

export interface CreateInventoryInput {
  variant_id: number;
  warehouse_id: number;
  stock_qty?: number;
  reserved_qty?: number;
  min_stock?: number;
  max_stock?: number;
}

export interface UpdateInventorySettingsInput {
  min_stock?: number;
  max_stock?: number;
}

export interface AdjustStockInput {
  qty: number;
  note?: string;
}

export interface ReserveStockInput {
  qty: number;
}

export interface ReleaseStockInput {
  qty: number;
}

export interface InventoryFilters {
  warehouse_id?: number;
  variant_id?: number;
  low_stock?: boolean;
}

export interface InventoryResponse {
  id: number;
  variant_id: number;
  warehouse_id: number;
  stock_qty: string;
  reserved_qty: string;
  available_qty: string;
  min_stock: string | null;
  max_stock: string | null;
}

const calculateAvailableQty = (
  stockQty: string,
  reservedQty: string
): string => {
  const stock = parseFloat(stockQty);
  const reserved = parseFloat(reservedQty);
  return (stock - reserved).toFixed(2);
};

const formatInventoryResponse = (inv: any): InventoryResponse => {
  return {
    id: Number(inv.id),
    variant_id: Number(inv.variantId),
    warehouse_id: Number(inv.warehouseId),
    stock_qty: inv.stockQty,
    reserved_qty: inv.reservedQty,
    available_qty: calculateAvailableQty(inv.stockQty, inv.reservedQty),
    min_stock: inv.minStock,
    max_stock: inv.maxStock,
  };
};

export async function createInventory(
  input: CreateInventoryInput
): Promise<InventoryResponse> {
  // Validation
  if (!input.variant_id || input.variant_id <= 0) {
    throw new Error('Variant ID is required and must be positive');
  }
  if (!input.warehouse_id || input.warehouse_id <= 0) {
    throw new Error('Warehouse ID is required and must be positive');
  }
  if (input.stock_qty !== undefined && input.stock_qty < 0) {
    throw new Error('Stock quantity cannot be negative');
  }
  if (input.reserved_qty !== undefined && input.reserved_qty < 0) {
    throw new Error('Reserved quantity cannot be negative');
  }
  if (
    input.min_stock !== undefined &&
    input.max_stock !== undefined &&
    input.min_stock >= input.max_stock
  ) {
    throw new Error('Minimum stock must be less than maximum stock');
  }

  // Check if variant exists
  const [variant] = await dbRead
    .select()
    .from(productVariants)
    .where(eq(productVariants.id, input.variant_id));
  if (!variant) {
    throw new Error('Product variant not found');
  }

  // Check if warehouse exists
  const [warehouse] = await dbRead
    .select()
    .from(warehouses)
    .where(eq(warehouses.id, input.warehouse_id));
  if (!warehouse) {
    throw new Error('Warehouse not found');
  }

  // Check if inventory already exists
  const existingInventory = await dbRead
    .select()
    .from(inventory)
    .where(
      and(
        eq(inventory.variantId, input.variant_id),
        eq(inventory.warehouseId, input.warehouse_id)
      )
    );
  if (existingInventory.length > 0) {
    throw new Error(
      'The inventory for this variant and warehouse already exists'
    );
  }

  // Create inventory
  const result = await db.insert(inventory).values({
    variantId: input.variant_id,
    warehouseId: input.warehouse_id,
    stockQty: input.stock_qty?.toFixed(2) || '0.00',
    reservedQty: input.reserved_qty?.toFixed(2) || '0.00',
    minStock: input.min_stock?.toFixed(2),
    maxStock: input.max_stock?.toFixed(2),
  });

  const [newInventory] = await dbRead
    .select()
    .from(inventory)
    .where(eq(inventory.id, result[0].insertId));

  return formatInventoryResponse(newInventory);
}

export async function getInventoryList(
  filters?: InventoryFilters
): Promise<InventoryResponse[]> {
  const conditions = [];

  if (filters?.warehouse_id) {
    conditions.push(eq(inventory.warehouseId, filters.warehouse_id));
  }

  if (filters?.variant_id) {
    conditions.push(eq(inventory.variantId, filters.variant_id));
  }

  let query: any = dbRead.select().from(inventory);
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const results = await query;

  let filteredResults = results;

  if (filters?.low_stock) {
    filteredResults = results.filter((inv: any) => {
      if (!inv.minStock) return false;
      const stockQty = parseFloat(inv.stockQty);
      const minStock = parseFloat(inv.minStock);
      return stockQty <= minStock;
    });
  }

  return filteredResults.map(formatInventoryResponse);
}

export async function getInventoryDetail(
  variantId: number,
  warehouseId: number
): Promise<InventoryResponse> {
  if (!variantId || variantId <= 0) {
    throw new Error('Invalid variant ID');
  }
  if (!warehouseId || warehouseId <= 0) {
    throw new Error('Invalid warehouse ID');
  }

  const [result] = await dbRead
    .select()
    .from(inventory)
    .where(
      and(
        eq(inventory.variantId, variantId),
        eq(inventory.warehouseId, warehouseId)
      )
    );

  if (!result) {
    throw new Error('Inventory not found');
  }

  return formatInventoryResponse(result);
}

export async function updateInventorySettings(
  variantId: number,
  warehouseId: number,
  input: UpdateInventorySettingsInput
): Promise<string> {
  if (!variantId || variantId <= 0) {
    throw new Error('Invalid variant ID');
  }
  if (!warehouseId || warehouseId <= 0) {
    throw new Error('Invalid warehouse ID');
  }

  if (
    input.min_stock !== undefined &&
    input.max_stock !== undefined &&
    input.min_stock >= input.max_stock
  ) {
    throw new Error('Minimum stock must be less than maximum stock');
  }

  const [existing] = await dbRead
    .select()
    .from(inventory)
    .where(
      and(
        eq(inventory.variantId, variantId),
        eq(inventory.warehouseId, warehouseId)
      )
    );

  if (!existing) {
    throw new Error('Inventory not found');
  }

  const updateData: any = {};
  if (input.min_stock !== undefined) {
    updateData.minStock = input.min_stock.toFixed(2);
  }
  if (input.max_stock !== undefined) {
    updateData.maxStock = input.max_stock.toFixed(2);
  }

  await db
    .update(inventory)
    .set(updateData)
    .where(
      and(
        eq(inventory.variantId, variantId),
        eq(inventory.warehouseId, warehouseId)
      )
    );

  return 'OK';
}

export async function adjustStock(
  variantId: number,
  warehouseId: number,
  input: AdjustStockInput
): Promise<{ stock_qty: string; available_qty: string }> {
  if (!variantId || variantId <= 0) {
    throw new Error('Invalid variant ID');
  }
  if (!warehouseId || warehouseId <= 0) {
    throw new Error('Invalid warehouse ID');
  }
  if (input.qty === 0) {
    throw new Error('Adjustment quantity cannot be zero');
  }

  const [existing] = await dbRead
    .select()
    .from(inventory)
    .where(
      and(
        eq(inventory.variantId, variantId),
        eq(inventory.warehouseId, warehouseId)
      )
    );

  if (!existing) {
    throw new Error('Inventory not found');
  }

  const currentStock = parseFloat(existing.stockQty);
  const currentReserved = parseFloat(existing.reservedQty);
  const newStock = currentStock + input.qty;

  if (newStock < 0) {
    throw new Error('Insufficient stock for this adjustment');
  }

  if (newStock < currentReserved) {
    throw new Error('Stock cannot be less than the reserved amount');
  }

  // Update with calculated value
  await db
    .update(inventory)
    .set({
      stockQty: newStock.toFixed(2),
    })
    .where(
      and(
        eq(inventory.variantId, variantId),
        eq(inventory.warehouseId, warehouseId)
      )
    );

  return {
    stock_qty: newStock.toFixed(2),
    available_qty: calculateAvailableQty(
      newStock.toFixed(2),
      existing.reservedQty
    ),
  };
}

export async function reserveStock(
  variantId: number,
  warehouseId: number,
  input: ReserveStockInput
): Promise<{ reserved_qty: string; available_qty: string }> {
  if (!variantId || variantId <= 0) {
    throw new Error('Invalid variant ID');
  }
  if (!warehouseId || warehouseId <= 0) {
    throw new Error('Invalid warehouse ID');
  }
  if (!input.qty || input.qty <= 0) {
    throw new Error('Reservation quantity must be positive');
  }

  const [existing] = await dbRead
    .select()
    .from(inventory)
    .where(
      and(
        eq(inventory.variantId, variantId),
        eq(inventory.warehouseId, warehouseId)
      )
    );

  if (!existing) {
    throw new Error('Inventory not found');
  }

  const currentStock = parseFloat(existing.stockQty);
  const currentReserved = parseFloat(existing.reservedQty);
  const newReserved = currentReserved + input.qty;

  if (newReserved > currentStock) {
    throw new Error('Insufficient stock for reservation');
  }

  // Update with calculated value
  await db
    .update(inventory)
    .set({
      reservedQty: newReserved.toFixed(2),
    })
    .where(
      and(
        eq(inventory.variantId, variantId),
        eq(inventory.warehouseId, warehouseId)
      )
    );

  return {
    reserved_qty: newReserved.toFixed(2),
    available_qty: calculateAvailableQty(
      existing.stockQty,
      newReserved.toFixed(2)
    ),
  };
}

export async function releaseStock(
  variantId: number,
  warehouseId: number,
  input: ReleaseStockInput
): Promise<{ reserved_qty: string; available_qty: string }> {
  if (!variantId || variantId <= 0) {
    throw new Error('Invalid variant ID');
  }
  if (!warehouseId || warehouseId <= 0) {
    throw new Error('Invalid warehouse ID');
  }
  if (!input.qty || input.qty <= 0) {
    throw new Error('Release quantity must be positive');
  }

  const [existing] = await dbRead
    .select()
    .from(inventory)
    .where(
      and(
        eq(inventory.variantId, variantId),
        eq(inventory.warehouseId, warehouseId)
      )
    );

  if (!existing) {
    throw new Error('Inventory not found');
  }

  const currentReserved = parseFloat(existing.reservedQty);
  const newReserved = currentReserved - input.qty;

  if (newReserved < 0) {
    throw new Error('Release quantity exceeds the reserved amount');
  }

  // Update with calculated value
  await db
    .update(inventory)
    .set({
      reservedQty: newReserved.toFixed(2),
    })
    .where(
      and(
        eq(inventory.variantId, variantId),
        eq(inventory.warehouseId, warehouseId)
      )
    );

  return {
    reserved_qty: newReserved.toFixed(2),
    available_qty: calculateAvailableQty(
      existing.stockQty,
      newReserved.toFixed(2)
    ),
  };
}

export async function deleteInventory(
  variantId: number,
  warehouseId: number
): Promise<string> {
  if (!variantId || variantId <= 0) {
    throw new Error('Invalid variant ID');
  }
  if (!warehouseId || warehouseId <= 0) {
    throw new Error('Invalid warehouse ID');
  }

  const [existing] = await dbRead
    .select()
    .from(inventory)
    .where(
      and(
        eq(inventory.variantId, variantId),
        eq(inventory.warehouseId, warehouseId)
      )
    );

  if (!existing) {
    throw new Error('Inventory not found');
  }

  if (parseFloat(existing.reservedQty) > 0) {
    throw new Error(
      'Cannot delete inventory that still has active reservations'
    );
  }

  await db
    .delete(inventory)
    .where(
      and(
        eq(inventory.variantId, variantId),
        eq(inventory.warehouseId, warehouseId)
      )
    );

  return 'OK';
}
