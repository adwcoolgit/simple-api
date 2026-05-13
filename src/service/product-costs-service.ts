import { eq, lte, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { productVariants, productCosts } from '../db/schema.js';

export interface CreateProductCostData {
  variantId: number;
  costPrice?: number;
  effectiveDate?: Date;
}

export interface UpdateProductCostData {
  costPrice?: number;
  effectiveDate?: Date;
}

export interface ProductCostResponse {
  id: number;
  variant_id: number;
  cost_price?: number;
  effective_date?: Date;
  created_at: Date;
}

/**
 * Create a new product cost record
 */
export async function createProductCost(data: CreateProductCostData): Promise<ProductCostResponse> {
  // Validate that variant exists
  const existingVariant = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.id, data.variantId))
    .limit(1);

  if (!existingVariant.length) {
    throw new Error('Variant tidak ditemukan');
  }

  // Insert the new record
  await db
    .insert(productCosts)
    .values({
      variantId: data.variantId,
      costPrice: data.costPrice,
      effectiveDate: data.effectiveDate,
    });

  // Get the inserted record
  const inserted = await db
    .select()
    .from(productCosts)
    .where(eq(productCosts.variantId, data.variantId))
    .orderBy(desc(productCosts.createdAt))
    .limit(1);

  return {
    id: inserted[0].id,
    variant_id: inserted[0].variantId,
    cost_price: inserted[0].costPrice,
    effective_date: inserted[0].effectiveDate,
    created_at: inserted[0].createdAt,
  };
}

/**
 * Get all product cost records for a specific variant
 */
export async function getProductCostsByVariant(variantId: number): Promise<ProductCostResponse[]> {
  // Validate that variant exists
  const existingVariant = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.id, variantId))
    .limit(1);

  if (!existingVariant.length) {
    throw new Error('Variant tidak ditemukan');
  }

  // Get all cost records ordered by effective_date DESC
  const costs = await db
    .select()
    .from(productCosts)
    .where(eq(productCosts.variantId, variantId))
    .orderBy(desc(productCosts.effectiveDate));

  return costs.map(cost => ({
    id: cost.id,
    variant_id: cost.variantId,
    cost_price: cost.costPrice,
    effective_date: cost.effectiveDate,
    created_at: cost.createdAt,
  }));
}

/**
 * Get the current (active) product cost for a specific variant
 */
export async function getCurrentProductCost(variantId: number): Promise<ProductCostResponse> {
  // Validate that variant exists
  const existingVariant = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.id, variantId))
    .limit(1);

  if (!existingVariant.length) {
    throw new Error('Variant tidak ditemukan');
  }

  // Get the most recent cost where effective_date <= NOW()
  const [currentCost] = await db
    .select()
    .from(productCosts)
    .where(eq(productCosts.variantId, variantId))
    .where(lte(productCosts.effectiveDate, new Date()))
    .orderBy(desc(productCosts.effectiveDate))
    .limit(1);

  if (!currentCost) {
    throw new Error('Harga pokok aktif tidak ditemukan');
  }

  return {
    id: currentCost.id,
    variant_id: currentCost.variantId,
    cost_price: currentCost.costPrice,
    effective_date: currentCost.effectiveDate,
    created_at: currentCost.createdAt,
  };
}

/**
 * Update a product cost record
 */
export async function updateProductCost(id: number, data: UpdateProductCostData): Promise<string> {
  // Check if record exists
  const existingRecord = await db
    .select()
    .from(productCosts)
    .where(eq(productCosts.id, id))
    .limit(1);

  if (!existingRecord.length) {
    throw new Error('Data tidak ditemukan');
  }

  // Prepare update data (only include fields that are provided)
  const updateData: Partial<typeof productCosts.$inferInsert> = {};
  if (data.costPrice !== undefined) {
    updateData.costPrice = data.costPrice;
  }
  if (data.effectiveDate !== undefined) {
    updateData.effectiveDate = data.effectiveDate;
  }

  // Update the record
  await db
    .update(productCosts)
    .set(updateData)
    .where(eq(productCosts.id, id));

  return 'OK';
}

/**
 * Delete a product cost record
 */
export async function deleteProductCost(id: number): Promise<string> {
  // Check if record exists
  const existingRecord = await db
    .select()
    .from(productCosts)
    .where(eq(productCosts.id, id))
    .limit(1);

  if (!existingRecord.length) {
    throw new Error('Data tidak ditemukan');
  }

  // Delete the record
  await db
    .delete(productCosts)
    .where(eq(productCosts.id, id));

  return 'OK';
}