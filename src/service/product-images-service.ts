import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { productVariants, productImages } from '../db/schema.js';

export interface AddProductImagesData {
  variantId: number;
  images: Array<{
    imageUrl: string;
    isPrimary: boolean;
  }>;
}

export interface ProductImageResponse {
  id: number;
  variant_id?: number;
  image_url?: string;
  is_primary: boolean;
}

/**
 * Add multiple product images for a variant
 */
export async function addProductImages(data: AddProductImagesData): Promise<ProductImageResponse[]> {
  // Validate business logic
  if (!data.images || data.images.length === 0) {
    throw new Error('Images must not be empty');
  }

  const primaryCount = data.images.filter(img => img.isPrimary).length;
  if (primaryCount !== 1) {
    throw new Error('Exactly one image must be set as primary');
  }

  // Validate that variant exists if provided
  if (data.variantId) {
    const existingVariant = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, data.variantId))
      .limit(1);

    if (!existingVariant.length) {
      throw new Error('Variant tidak ditemukan');
    }
  }

  // Run in transaction
  return await db.transaction(async (tx) => {
    // Reset all existing images for this variant to non-primary
    if (data.variantId) {
      await tx
        .update(productImages)
        .set({ isPrimary: false })
        .where(eq(productImages.variantId, data.variantId));
    }

    // Insert images one by one to ensure proper handling
    const results: ProductImageResponse[] = [];

    for (const img of data.images) {
      const insertResult = await tx
        .insert(productImages)
        .values({
          variantId: data.variantId,
          imageUrl: img.imageUrl,
          isPrimary: img.isPrimary,
        });

      // Get the inserted record by querying for the latest insert
      // Since we can't rely on .returning() in all environments
      const [inserted] = await tx
        .select()
        .from(productImages)
        .where(eq(productImages.variantId, data.variantId))
        .orderBy(desc(productImages.id))
        .limit(1);

      if (!inserted) {
        throw new Error('Failed to insert image');
      }

      results.push({
        id: inserted.id,
        variant_id: inserted.variantId,
        image_url: inserted.imageUrl,
        is_primary: inserted.isPrimary,
      });
    }

    return results;
  });
}

/**
 * Get all images for a specific variant
 */
export async function getImagesByVariant(variantId: number): Promise<ProductImageResponse[]> {
  // Validate that variant exists
  const existingVariant = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.id, variantId))
    .limit(1);

  if (!existingVariant.length) {
    throw new Error('Variant tidak ditemukan');
  }

  // Get all images, ordered by is_primary DESC
  const images = await db
    .select()
    .from(productImages)
    .where(eq(productImages.variantId, variantId))
    .orderBy(desc(productImages.isPrimary), desc(productImages.id));

    return images.map(img => ({
      id: img.id,
      variant_id: img.variantId,
      image_url: img.imageUrl,
      is_primary: img.isPrimary,
    }));
}

/**
 * Set an image as primary for its variant
 */
export async function setPrimaryImage(imageId: number, variantId: number): Promise<string> {
  // Check if image exists and belongs to the variant
  const existingImage = await db
    .select()
    .from(productImages)
    .where(and(eq(productImages.id, imageId), eq(productImages.variantId, variantId)))
    .limit(1);

  if (!existingImage.length) {
    throw new Error('Image not found');
  }

  // Run in transaction
  await db.transaction(async (tx) => {
    // Reset all images for this variant to non-primary
    await tx
      .update(productImages)
      .set({ isPrimary: false })
      .where(eq(productImages.variantId, variantId));

    // Set the specified image as primary
    await tx
      .update(productImages)
      .set({ isPrimary: true })
      .where(eq(productImages.id, imageId));
  });

  return 'OK';
}

/**
 * Get the primary image for a variant
 */
export async function getPrimaryImage(variantId: number): Promise<ProductImageResponse> {
  // Validate that variant exists
  const existingVariant = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.id, variantId))
    .limit(1);

  if (!existingVariant.length) {
    throw new Error('Variant tidak ditemukan');
  }

  // Get the primary image
  const [primaryImage] = await db
    .select()
    .from(productImages)
    .where(and(eq(productImages.variantId, variantId), eq(productImages.isPrimary, true)))
    .limit(1);

  if (!primaryImage) {
    throw new Error('Gambar primary tidak ditemukan');
  }

    return {
      id: primaryImage.id,
      variant_id: primaryImage.variantId,
      image_url: primaryImage.imageUrl,
      is_primary: primaryImage.isPrimary,
    };
}

/**
 * Delete a product image
 */
export async function deleteProductImage(imageId: number): Promise<string> {
  // Check if image exists
  const existingImage = await db
    .select()
    .from(productImages)
    .where(eq(productImages.id, imageId))
    .limit(1);

  if (!existingImage.length) {
    throw new Error('Image not found');
  }

  // Delete the image
  await db
    .delete(productImages)
    .where(eq(productImages.id, imageId));

  return 'OK';
}