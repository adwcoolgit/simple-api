import {
  products,
  productVariants,
  productPrices,
  productCosts,
  inventory,
  barcodes,
  productTaxes,
  productImages,
  variantAttributes,
  warehouses,
} from '../db/schema';
import { db, dbRead } from '../db';
import { eq, and, desc, sql } from 'drizzle-orm';

export interface CreateProductInput {
  name: string;
  description?: string;
  categoryId?: number;
  departmentId?: number;
  isActive?: boolean;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  categoryId?: number;
  departmentId?: number;
  isActive?: boolean;
}

export interface GetProductsFilters {
  isActive?: boolean;
  categoryId?: number;
  departmentId?: number;
  page?: number;
  limit?: number;
}

export interface ProductsPaginationMeta {
  total: number;
  page: number;
  limit: number;
}

export async function createProduct(input: CreateProductInput) {
  // Input validation
  if (!input.name || input.name.trim().length === 0) {
    throw new Error('name is required');
  }
  if (input.name.length > 255) {
    throw new Error('The name is too long, with a maximum of 255 characters');
  }
  if (input.description && input.description.length > 255) {
    throw new Error(
      'The description is too long, with a maximum of 255 characters'
    );
  }

  try {
    const [newProduct] = await db
      .insert(products)
      .values({
        name: input.name,
        description: input.description,
        categoryId: input.categoryId,
        departmentId: input.departmentId,
        isActive: input.isActive ?? true,
      })
      .$returningId();

    if (!newProduct) {
      throw new Error('Failed to create product');
    }

    // Get the created product
    const [createdProduct] = await dbRead
      .select()
      .from(products)
      .where(eq(products.productId, newProduct.productId));

    if (!createdProduct) {
      throw new Error('Failed to retrieve created product');
    }

    return createdProduct;
  } catch (error: any) {
    console.error('Create product error:', error);

    // Handle database constraint violation
    if (
      error?.message?.includes('varchar') ||
      error?.message?.includes('length') ||
      error?.code === 'ER_DATA_TOO_LONG' ||
      error?.message?.includes('Data too long')
    ) {
      throw new Error('Input is too long, maximum 255 characters');
    }

    throw new Error('Failed to create product');
  }
}

export async function getProducts(filters: GetProductsFilters = {}) {
  const page = filters.page || 1;
  const limit = filters.limit || 10;
  const offset = (page - 1) * limit;

  try {
    let whereConditions = [];

    if (filters.isActive !== undefined) {
      whereConditions.push(eq(products.isActive, filters.isActive));
    }

    if (filters.categoryId !== undefined) {
      whereConditions.push(eq(products.categoryId, filters.categoryId));
    }

    if (filters.departmentId !== undefined) {
      whereConditions.push(eq(products.departmentId, filters.departmentId));
    }

    const whereClause =
      whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Get total count
    const countResult = await dbRead
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(whereClause);

    const count = countResult[0]?.count || 0;

    // Get paginated products
    const productList = await dbRead
      .select()
      .from(products)
      .where(whereClause)
      .orderBy(desc(products.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      data: productList,
      meta: {
        total: count,
        page,
        limit,
      },
    };
  } catch (error: any) {
    console.error('Get products error:', error);
    throw new Error('Failed to retrieve products');
  }
}

export async function getProductByProductId(productId: number) {
  try {
    const [product] = await dbRead
      .select()
      .from(products)
      .where(eq(products.productId, productId));

    if (!product) throw new Error('Product not found');
    if (product.isActive === false) throw new Error('Product not found');

    // Fetch variants with full details
    const variants = await dbRead
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, productId));

    const variantIds = variants.map((v) => v.id);

    // Related data for variants
    const prices = variantIds.length
      ? await dbRead
          .select()
          .from(productPrices)
          .where(sql`${productPrices.variant_id} IN (${variantIds.join(',')})`)
      : [];
    const costs = variantIds.length
      ? await dbRead
          .select()
          .from(productCosts)
          .where(sql`${productCosts.variantId} IN (${variantIds.join(',')})`)
      : [];
    const taxes = variantIds.length
      ? await dbRead
          .select()
          .from(productTaxes)
          .where(sql`${productTaxes.variantId} IN (${variantIds.join(',')})`)
      : [];
    const barcs = variantIds.length
      ? await dbRead
          .select()
          .from(barcodes)
          .where(sql`${barcodes.variantId} IN (${variantIds.join(',')})`)
      : [];
    const imgs = variantIds.length
      ? await dbRead
          .select()
          .from(productImages)
          .where(sql`${productImages.variantId} IN (${variantIds.join(',')})`)
      : [];
    const attrs = variantIds.length
      ? await dbRead
          .select()
          .from(variantAttributes)
          .where(
            sql`${variantAttributes.variantId} IN (${variantIds.join(',')})`
          )
      : [];
    const inv = variantIds.length
      ? await dbRead
          .select({
            stockQty: inventory.stockQty,
            variantId: inventory.variantId,
          })
          .from(inventory)
          .where(sql`${inventory.variantId} IN (${variantIds.join(',')})`)
      : [];

    // Attach to variants
    const variantsWithDetails = variants.map((variant) => ({
      ...variant,
      prices: prices.filter((p) => {
        return p.variant_id === variant.id && p.price_type === 'retail';
      }),
      costs: costs.filter((c) => c.variantId === variant.id),
      taxes: taxes.filter((t) => t.variantId === variant.id),
      barcodes: barcs.filter((b) => b.variantId === variant.id),
      images: imgs.filter((i) => i.variantId === variant.id),
      attributes: attrs.filter((a) => a.variantId === variant.id),
      inventory: inv.filter((i) => i.variantId === variant.id),
    }));

    return { ...product, variants: variantsWithDetails };
  } catch (error: any) {
    console.error('Get product by product ID error:', error);
    if (error instanceof Error && error.message === 'Product not found')
      throw error;
    throw new Error('Failed to retrieve product');
  }
}

export async function updateProduct(
  productId: number,
  input: UpdateProductInput
) {
  // Input validation
  if (input.name !== undefined) {
    if (!input.name || input.name.trim().length === 0) {
      throw new Error('name is required');
    }
    if (input.name.length > 255) {
      throw new Error('name is too long, maximum 255 characters');
    }
  }
  if (input.description !== undefined && input.description.length > 255) {
    throw new Error('description is too long, maximum 255 characters');
  }

  try {
    // Check if product exists
    const [existingProduct] = await dbRead
      .select()
      .from(products)
      .where(eq(products.productId, productId));

    if (!existingProduct) {
      throw new Error('Product not found');
    }

    // Prepare update data
    const updateData: {
      name?: string;
      description?: string;
      categoryId?: number;
      departmentId?: number;
      isActive?: boolean;
    } = {};

    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    if (input.description !== undefined) {
      updateData.description = input.description;
    }
    if (input.categoryId !== undefined) {
      updateData.categoryId = input.categoryId;
    }
    if (input.departmentId !== undefined) {
      updateData.departmentId = input.departmentId;
    }
    if (input.isActive !== undefined) {
      updateData.isActive = input.isActive;
    }

    // Perform partial update
    await db
      .update(products)
      .set(updateData)
      .where(eq(products.productId, productId));

    // Return updated product
    const [updatedProduct] = await dbRead
      .select()
      .from(products)
      .where(eq(products.productId, productId));

    if (!updatedProduct) {
      throw new Error('Failed to retrieve updated product');
    }

    return updatedProduct;
  } catch (error: any) {
    console.error('Update product error:', error);

    // Handle database constraint violation
    if (
      error?.message?.includes('varchar') ||
      error?.message?.includes('length') ||
      error?.code === 'ER_DATA_TOO_LONG' ||
      error?.message?.includes('Data too long')
    ) {
      throw new Error('Input is too long, maximum 255 characters');
    }

    if (error instanceof Error && error.message === 'Product not found') {
      throw error;
    }

    throw new Error('Failed to update product');
  }
}

export async function deleteProduct(productId: number) {
  try {
    // Check if product exists
    const [existingProduct] = await dbRead
      .select()
      .from(products)
      .where(eq(products.productId, productId));

    if (!existingProduct) {
      throw new Error('Product not found');
    }

    // Soft delete - set is_active to false
    await db
      .update(products)
      .set({
        isActive: false,
      })
      .where(eq(products.productId, productId));

    return 'OK';
  } catch (error: any) {
    console.error('Delete product error:', error);

    if (error instanceof Error && error.message === 'Product not found') {
      throw error;
    }

    throw new Error('Failed to delete product');
  }
}
