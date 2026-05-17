import { eq, lte, desc, and } from 'drizzle-orm';
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
  cost_price?: number | null;
  effective_date?: string;
  created_at: string;
}

/**
 * Create a new product cost record
 */
export async function createProductCost(
  data: CreateProductCostData
): Promise<ProductCostResponse> {
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
  await db.insert(productCosts).values({
    variantId: data.variantId,
    costPrice: data.costPrice,
    effectiveDate: data.effectiveDate,
  } as any);

  // Get the inserted record
  const [record] = await db
    .select()
    .from(productCosts)
    .where(eq(productCosts.variantId, data.variantId))
    .orderBy(desc(productCosts.createdAt))
    .limit(1);

  if (!record) throw new Error('Failed to retrieve inserted record');

  return {
    id: record.id,
    variant_id: record.variantId,
    cost_price:
      record.costPrice != null
        ? parseFloat(record.costPrice as any)
        : undefined,
    effective_date: record.effectiveDate?.toISOString(),
    created_at: record.createdAt.toISOString(),
  };
}

/**
 * Get all product cost records for a specific variant
 */
export async function getProductCostsByVariant(
  variantId: number
): Promise<ProductCostResponse[]> {
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

  return costs.map((cost) => ({
    id: cost.id,
    variant_id: cost.variantId,
    cost_price: cost.costPrice as number | null,
    effective_date: cost.effectiveDate?.toISOString(),
    created_at: cost.createdAt.toISOString(),
  }));
}

/**
 * Get the current (active) product cost for a specific variant
 */
export async function getCurrentProductCost(
  variantId: number
): Promise<ProductCostResponse> {
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
    .where(
      and(
        eq(productCosts.variantId, variantId),
        lte(productCosts.effectiveDate, new Date())
      ) as any
    )
    .orderBy(desc(productCosts.effectiveDate))
    .limit(1);

  if (!currentCost) {
    throw new Error('Harga pokok aktif tidak ditemukan');
  }

  return {
    id: currentCost.id,
    variant_id: currentCost.variantId,
    cost_price: currentCost.costPrice as number | null,
    effective_date: currentCost.effectiveDate?.toISOString(),
    created_at: currentCost.createdAt.toISOString(),
  };
}

/**
 * Update a product cost record
 */
export async function updateProductCost(
  id: number,
  data: UpdateProductCostData
): Promise<string> {
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
    updateData.costPrice = data.costPrice.toString();
  }
  if (data.effectiveDate !== undefined) {
    updateData.effectiveDate = data.effectiveDate;
  }

  // Update the record
  await db.update(productCosts).set(updateData).where(eq(productCosts.id, id));

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
  await db.delete(productCosts).where(eq(productCosts.id, id));

  return 'OK';
}
