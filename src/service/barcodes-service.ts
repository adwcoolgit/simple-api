import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { productVariants, barcodes } from '../db/schema.js';

export interface CreateBarcodeData {
  variantId: number;
  barcode: string;
}

export interface BarcodeResponse {
  id: number;
  variant_id: number;
  barcode: string;
}

/**
 * Create a new barcode
 */
export async function createBarcode(data: CreateBarcodeData): Promise<BarcodeResponse> {
  // Validate that variant exists
  const existingVariant = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.id, data.variantId))
    .limit(1);

  if (!existingVariant.length) {
    throw new Error('Variant tidak ditemukan');
  }

  // Check if barcode already exists
  const existingBarcode = await db
    .select()
    .from(barcodes)
    .where(eq(barcodes.barcode, data.barcode))
    .limit(1);

  if (existingBarcode.length) {
    throw new Error('Barcode sudah digunakan');
  }

  // Insert new barcode
  await db
    .insert(barcodes)
    .values({
      variantId: data.variantId,
      barcode: data.barcode,
    });

  // Get the inserted record
  const [inserted] = await db
    .select()
    .from(barcodes)
    .where(eq(barcodes.barcode, data.barcode))
    .limit(1);

  if (!inserted) {
    throw new Error('Failed to insert barcode');
  }

  return {
    id: inserted.id,
    variant_id: inserted.variantId,
    barcode: inserted.barcode,
  };
}

/**
 * Get all barcodes for a variant
 */
export async function getBarcodesByVariant(variantId: number): Promise<BarcodeResponse[]> {
  // Validate that variant exists
  const existingVariant = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.id, variantId))
    .limit(1);

  if (!existingVariant.length) {
    throw new Error('Variant tidak ditemukan');
  }

  // Get all barcodes for this variant
  const result = await db
    .select()
    .from(barcodes)
    .where(eq(barcodes.variantId, variantId));

  return result.map(barcode => ({
    id: barcode.id,
    variant_id: barcode.variantId,
    barcode: barcode.barcode,
  }));
}

/**
 * Get a barcode by ID
 */
export async function getBarcodeById(id: number): Promise<BarcodeResponse> {
  const result = await db
    .select()
    .from(barcodes)
    .where(eq(barcodes.id, id))
    .limit(1);

  if (!result.length) {
    throw new Error('Barcode tidak ditemukan');
  }

  const barcode = result[0];
  return {
    id: barcode.id,
    variant_id: barcode.variantId,
    barcode: barcode.barcode,
  };
}

/**
 * Delete a barcode
 */
export async function deleteBarcode(id: number): Promise<string> {
  // Check if barcode exists
  const existingBarcode = await db
    .select()
    .from(barcodes)
    .where(eq(barcodes.id, id))
    .limit(1);

  if (!existingBarcode.length) {
    throw new Error('Barcode tidak ditemukan');
  }

  // Delete the barcode
  await db
    .delete(barcodes)
    .where(eq(barcodes.id, id));

  return 'OK';
}