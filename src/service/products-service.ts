import { products } from '../db/schema';
import { db, dbRead } from '../db';
import { eq, and, desc, sql } from 'drizzle-orm';

export interface CreateProductInput {
  pluName: string;
  description?: string;
  categoryId?: number;
  departmentId?: number;
  isActive?: boolean;
}

export interface UpdateProductInput {
  pluName?: string;
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
  if (!input.pluName || input.pluName.trim().length === 0) {
    throw new Error('plu_name is required');
  }
  if (input.pluName.length > 255) {
    throw new Error('plu_name terlalu panjang, maksimal 255 karakter');
  }
  if (input.description && input.description.length > 255) {
    throw new Error('description terlalu panjang, maksimal 255 karakter');
  }

  try {
    const [newProduct] = await db.insert(products).values({
      pluName: input.pluName,
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
      .where(eq(products.pluNo, newProduct.pluNo));

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
      whereConditions.push(eq(products.isActive, filters.isActive === true || filters.isActive === 'true'));
    }

    if (filters.categoryId !== undefined) {
      whereConditions.push(eq(products.categoryId, filters.categoryId));
    }

    if (filters.departmentId !== undefined) {
      whereConditions.push(eq(products.departmentId, filters.departmentId));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Get total count
    const [{ count }] = await dbRead
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(whereClause);

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

export async function getProductByPluNo(pluNo: number) {
  try {
    const [product] = await dbRead
      .select()
      .from(products)
      .where(eq(products.pluNo, pluNo));

    if (!product) {
      throw new Error('Product tidak ditemukan');
    }

    if (product.isActive === false || product.isActive === 0) {
      throw new Error('Product tidak ditemukan');
    }

    return product;
  } catch (error: any) {
    console.error('Get product by PLU error:', error);

    if (error instanceof Error && error.message === 'Product tidak ditemukan') {
      throw error;
    }

    throw new Error('Gagal mengambil data product');
  }
}

export async function updateProduct(pluNo: number, input: UpdateProductInput) {
  // Input validation
  if (input.pluName !== undefined) {
    if (!input.pluName || input.pluName.trim().length === 0) {
      throw new Error('plu_name is required');
    }
    if (input.pluName.length > 255) {
      throw new Error('plu_name terlalu panjang, maksimal 255 karakter');
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
      .where(eq(products.pluNo, pluNo));

    if (!existingProduct) {
      throw new Error('Product tidak ditemukan');
    }

    // Prepare update data
    const updateData: any = {};

    if (input.pluName !== undefined) {
      updateData.pluName = input.pluName;
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
    await db.update(products).set(updateData).where(eq(products.pluNo, pluNo));

    // Return updated product
    const [updatedProduct] = await dbRead
      .select()
      .from(products)
      .where(eq(products.pluNo, pluNo));

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

export async function deleteProduct(pluNo: number) {
  try {
    // Check if product exists
    const [existingProduct] = await dbRead
      .select()
      .from(products)
      .where(eq(products.pluNo, pluNo));

    if (!existingProduct) {
      throw new Error('Product tidak ditemukan');
    }

    // Soft delete - set is_active to false
    await db.update(products).set({
      isActive: false,
    }).where(eq(products.pluNo, pluNo));

    return 'OK';
  } catch (error: any) {
    console.error('Delete product error:', error);

    if (error instanceof Error && error.message === 'Product tidak ditemukan') {
      throw error;
    }

    throw new Error('Gagal menghapus product');
  }
}