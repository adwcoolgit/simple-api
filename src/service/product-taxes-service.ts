import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { productVariants, productTaxes } from '../db/schema.js';

export interface CreateProductTaxData {
  variantId: number;
  tax_code?: string;
  is_inclusive?: boolean;
}

export interface ProductTaxResponse {
  id: number;
  variant_id: number;
  tax_code: string | null;
  is_inclusive: boolean;
}

/**
 * Create a new product tax configuration
 */
export async function createProductTax(
  data: CreateProductTaxData
): Promise<ProductTaxResponse> {
  // Validate that variant exists
  const existingVariant = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.id, data.variantId))
    .limit(1);

  if (!existingVariant.length) {
    throw new Error('Variant tidak ditemukan');
  }

  // Check if variant already has tax configuration
  const existingTax = await db
    .select()
    .from(productTaxes)
    .where(eq(productTaxes.variantId, data.variantId))
    .limit(1);

  if (existingTax.length) {
    throw new Error('Variant sudah memiliki konfigurasi pajak');
  }

  // Insert new tax configuration
  await db.insert(productTaxes).values({
    variantId: data.variantId,
    taxCode: data.tax_code || null,
    isInclusive: data.is_inclusive !== undefined ? data.is_inclusive : false,
  });

  // Get the inserted record
  const [inserted] = await db
    .select()
    .from(productTaxes)
    .where(eq(productTaxes.variantId, data.variantId))
    .limit(1);

  if (!inserted) {
    throw new Error('Failed to insert product tax');
  }

  console.log('Inserted product tax:', inserted);
  return {
    id: inserted.id,
    variant_id: inserted.variantId,
    tax_code: inserted.taxCode,
    is_inclusive: inserted.isInclusive,
  };
}

/**
 * Get product tax configuration by variant ID
 */
export async function getProductTaxByVariantId(
  variantId: number
): Promise<ProductTaxResponse> {
  const result = await db
    .select()
    .from(productTaxes)
    .where(eq(productTaxes.variantId, variantId))
    .limit(1);

  if (!result.length) {
    throw new Error('Konfigurasi pajak tidak ditemukan');
  }

  const tax = result[0]!;
  return {
    id: tax.id,
    variant_id: tax.variantId,
    tax_code: tax.taxCode,
    is_inclusive: tax.isInclusive,
  };
}

/**
 * Update product tax configuration
 */
export async function updateProductTax(
  id: number,
  data: Partial<CreateProductTaxData>
): Promise<ProductTaxResponse> {
  // Check if tax configuration exists
  const existingTax = await db
    .select()
    .from(productTaxes)
    .where(eq(productTaxes.id, id))
    .limit(1);

  if (!existingTax.length) {
    throw new Error('Konfigurasi pajak tidak ditemukan');
  }

  // Prepare update data
  const updateData: any = {};
  if (data.tax_code !== undefined) {
    updateData.taxCode = data.tax_code;
  }
  if (data.is_inclusive !== undefined) {
    updateData.isInclusive = data.is_inclusive;
  }

  // Update the record
  await db.update(productTaxes).set(updateData).where(eq(productTaxes.id, id));

  // Get the updated record
  const [updated] = await db
    .select()
    .from(productTaxes)
    .where(eq(productTaxes.id, id))
    .limit(1);

  if (!updated) {
    throw new Error('Konfigurasi pajak tidak ditemukan');
  }

  return {
    id: updated.id,
    variant_id: updated.variantId,
    tax_code: updated.taxCode,
    is_inclusive: updated.isInclusive,
  };
}

/**
 * Delete product tax configuration
 */
export async function deleteProductTax(id: number): Promise<void> {
  // Check if tax configuration exists
  const existingTax = await db
    .select()
    .from(productTaxes)
    .where(eq(productTaxes.id, id))
    .limit(1);

  if (!existingTax.length) {
    throw new Error('Konfigurasi pajak tidak ditemukan');
  }

  // Delete the record
  await db.delete(productTaxes).where(eq(productTaxes.id, id));
}
