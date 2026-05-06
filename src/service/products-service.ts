import { products } from '../db/schema';
import { db, dbRead } from '../db';
import { eq, and, desc, sql } from 'drizzle-orm';

export interface CreateProductInput {
  productName: string;
  description?: string;
  categoryId?: number;
  departmentId?: number;
  isActive?: boolean;
}

export interface UpdateProductInput {
  productName?: string;
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
  if (!input.productName || input.productName.trim().length === 0) {
    throw new Error('product_name is required');
  }
  if (input.productName.length > 255) {
    throw new Error('product_name terlalu panjang, maksimal 255 karakter');
  }
  if (input.description && input.description.length > 255) {
    throw new Error('description terlalu panjang, maksimal 255 karakter');
  }

  try {
    const [newProduct] = await db.insert(products).values({
      productName: input.productName,
      description: input.description,
      categoryId: input.categoryId,
      departmentId: input.departmentId,
      isActive: input.isActive ?? true,
    }).$returningId();

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
      throw new Error('Input terlalu panjang, maksimal 255 karakter');
    }

    throw new Error('Gagal membuat product');
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

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

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
    throw new Error('Gagal mengambil data products');
  }
}

export async function getProductByProductId(productId: number) {
  try {
    const [product] = await dbRead
      .select()
      .from(products)
      .where(eq(products.productId, productId));

    if (!product) {
      throw new Error('Product tidak ditemukan');
    }

    if (product.isActive === false) {
      throw new Error('Product tidak ditemukan');
    }

    return product;
  } catch (error: any) {
    console.error('Get product by product ID error:', error);

    if (error instanceof Error && error.message === 'Product tidak ditemukan') {
      throw error;
    }

    throw new Error('Gagal mengambil data product');
  }
}

export async function updateProduct(productId: number, input: UpdateProductInput) {
  // Input validation
  if (input.productName !== undefined) {
    if (!input.productName || input.productName.trim().length === 0) {
      throw new Error('product_name is required');
    }
    if (input.productName.length > 255) {
      throw new Error('product_name terlalu panjang, maksimal 255 karakter');
    }
  }
  if (input.description !== undefined && input.description.length > 255) {
    throw new Error('description terlalu panjang, maksimal 255 karakter');
  }

  try {
    // Check if product exists
    const [existingProduct] = await dbRead
      .select()
      .from(products)
      .where(eq(products.productId, productId));

    if (!existingProduct) {
      throw new Error('Product tidak ditemukan');
    }

    // Prepare update data
    const updateData: any = {};

    if (input.productName !== undefined) {
      updateData.productName = input.productName;
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
    await db.update(products).set(updateData).where(eq(products.productId, productId));

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
      throw new Error('Input terlalu panjang, maksimal 255 karakter');
    }

    if (error instanceof Error && error.message === 'Product tidak ditemukan') {
      throw error;
    }

    throw new Error('Gagal memperbarui product');
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
      throw new Error('Product tidak ditemukan');
    }

    // Soft delete - set is_active to false
    await db.update(products).set({
      isActive: false,
    }).where(eq(products.productId, productId));

    return 'OK';
  } catch (error: any) {
    console.error('Delete product error:', error);

    if (error instanceof Error && error.message === 'Product tidak ditemukan') {
      throw error;
    }

    throw new Error('Gagal menghapus product');
  }
}