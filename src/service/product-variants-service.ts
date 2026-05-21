import { productVariants, products } from '../db/schema';
import { db, dbRead } from '../db';
import { eq, and, not } from 'drizzle-orm';

export interface CreateProductVariantInput {
  productId: number;
  sku: string;
  variantName?: string;
  uom?: string;
  isActive?: boolean;
  isSellable?: boolean;
}

export interface UpdateProductVariantInput {
  sku?: string;
  variantName?: string;
  uom?: string;
  isActive?: boolean;
  isSellable?: boolean;
}

export async function createProductVariant(input: CreateProductVariantInput) {
  // Input validation
  if (!input.sku || input.sku.trim().length === 0) {
    throw new Error('sku is required');
  }
  if (input.sku.length > 50) {
    throw new Error('sku is too long, maximum 50 characters');
  }
  if (input.variantName && input.variantName.length > 100) {
    throw new Error('variant_name is too long, maximum 100 characters');
  }
  if (input.uom && input.uom.length > 10) {
    throw new Error('uom is too long, maximum 10 characters');
  }

  try {
    // Check if product exists
    const [existingProduct] = await dbRead
      .select()
      .from(products)
      .where(eq(products.productId, input.productId));

    if (!existingProduct) {
      throw new Error('Product not found');
    }

    // Check if SKU is unique
    const [existingVariant] = await dbRead
      .select()
      .from(productVariants)
      .where(eq(productVariants.sku, input.sku));

    if (existingVariant) {
      throw new Error('SKU is already in use');
    }

    const [newVariant] = await db
      .insert(productVariants)
      .values({
        productId: input.productId,
        sku: input.sku,
        variantName: input.variantName,
        uom: input.uom,
        isActive: input.isActive ?? true,
        isSellable: input.isSellable ?? true,
      })
      .$returningId();

    if (!newVariant) {
      throw new Error('Failed to create product variant');
    }

    // Get the created variant
    const [createdVariant] = await dbRead
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, newVariant.id));

    if (!createdVariant) {
      throw new Error('Failed to retrieve created product variant');
    }

    return createdVariant;
  } catch (error: any) {
    console.error('Create product variant error:', error);

    // Handle database constraint violation
    if (
      error?.message?.includes('varchar') ||
      error?.message?.includes('length') ||
      error?.code === 'ER_DATA_TOO_LONG' ||
      error?.message?.includes('Data too long')
    ) {
      throw new Error('Input is too long');
    }

    if (
      error instanceof Error &&
      (error.message === 'Product not found' ||
        error.message === 'SKU is already in use')
    ) {
      throw error;
    }

    throw new Error('Failed to create product variant');
  }
}

export async function getProductVariants(productId: number) {
  try {
    const variants = await dbRead
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, productId));

    return variants;
  } catch (error: any) {
    console.error('Get product variants error:', error);
    throw new Error('Failed to retrieve product variants');
  }
}

export async function getProductVariantById(id: number) {
  try {
    const [variant] = await dbRead
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, id));

    if (!variant) {
      throw new Error('Product variant not found');
    }

    return variant;
  } catch (error: any) {
    console.error('Get product variant by ID error:', error);

    if (
      error instanceof Error &&
      error.message === 'Product variant not found'
    ) {
      throw error;
    }

    throw new Error('Failed to retrieve product variant');
  }
}

export async function updateProductVariant(
  id: number,
  input: UpdateProductVariantInput
) {
  // Input validation
  if (input.sku !== undefined) {
    if (!input.sku || input.sku.trim().length === 0) {
      throw new Error('sku is required');
    }
    if (input.sku.length > 50) {
      throw new Error('sku is too long, maximum 50 characters');
    }
  }
  if (input.variantName !== undefined && input.variantName.length > 100) {
    throw new Error('variant_name is too long, maximum 100 characters');
  }
  if (input.uom !== undefined && input.uom.length > 10) {
    throw new Error('uom is too long, maximum 10 characters');
  }

  try {
    // Check if variant exists
    const [existingVariant] = await dbRead
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, id));

    if (!existingVariant) {
      throw new Error('Product variant not found');
    }

    // Check SKU uniqueness if updating SKU
    if (input.sku !== undefined && input.sku !== existingVariant.sku) {
      const [existingSkuVariant] = await dbRead
        .select()
        .from(productVariants)
        .where(
          and(
            eq(productVariants.sku, input.sku),
            not(eq(productVariants.id, id))
          )
        );

      if (existingSkuVariant) {
        throw new Error('SKU is already in use');
      }
    }

    // Prepare update data
    const updateData: any = {};

    if (input.sku !== undefined) {
      updateData.sku = input.sku;
    }
    if (input.variantName !== undefined) {
      updateData.variantName = input.variantName;
    }
    if (input.uom !== undefined) {
      updateData.uom = input.uom;
    }
    if (input.isActive !== undefined) {
      updateData.isActive = input.isActive;
    }
    if (input.isSellable !== undefined) {
      updateData.isSellable = input.isSellable;
    }

    // Perform partial update
    await db
      .update(productVariants)
      .set(updateData)
      .where(eq(productVariants.id, id));

    return 'OK';
  } catch (error: any) {
    console.error('Update product variant error:', error);

    // Handle database constraint violation
    if (
      error?.message?.includes('varchar') ||
      error?.message?.includes('length') ||
      error?.code === 'ER_DATA_TOO_LONG' ||
      error?.message?.includes('Data too long')
    ) {
      throw new Error('Input is too long');
    }

    if (
      error instanceof Error &&
      (error.message === 'Product variant not found' ||
        error.message === 'SKU is already in use')
    ) {
      throw error;
    }

    throw new Error('Failed to update product variant');
  }
}

export async function deleteProductVariant(id: number) {
  try {
    // Check if variant exists
    const [existingVariant] = await dbRead
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, id));

    if (!existingVariant) {
      throw new Error('Product variant not found');
    }

    // Delete the variant
    await db.delete(productVariants).where(eq(productVariants.id, id));

    return 'OK';
  } catch (error: any) {
    console.error('Delete product variant error:', error);

    if (
      error instanceof Error &&
      error.message === 'Product variant not found'
    ) {
      throw error;
    }

    throw new Error('Failed to delete product variant');
  }
}
