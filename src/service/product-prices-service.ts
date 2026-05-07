import { productPrices, productVariants } from '../db/schema';
import { db, dbRead } from '../db';
import { eq, and, or, gte, lte, sql, desc, asc, isNull } from 'drizzle-orm';

export interface CreateProductPriceInput {
  variant_id: number;
  price_type: 'retail' | 'member' | 'reseller';
  price: number;
  start_date?: string; // ISO string
  end_date?: string; // ISO string
}

export interface UpdateProductPriceInput {
  price?: number;
  start_date?: string;
  end_date?: string;
}

export interface GetProductPricesFilters {
  variant_id?: number;
  price_type?: 'retail' | 'member' | 'reseller';
  page?: number;
  limit?: number;
}

export interface ProductPricesPaginationMeta {
  total: number;
  page: number;
  limit: number;
}

export async function createProductPrice(input: CreateProductPriceInput) {
  // Input validation
  if (input.price <= 0) {
    throw new Error('Price must be greater than 0');
  }
  if (input.start_date && input.end_date && new Date(input.start_date) >= new Date(input.end_date)) {
    throw new Error('start_date must be before end_date');
  }

  try {
    // Check if variant exists
    const [variant] = await dbRead
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, input.variant_id));

    if (!variant) {
      throw new Error('Variant tidak ditemukan');
    }

    // Check for overlap
    await checkOverlap(input.variant_id, input.price_type, input.start_date, input.end_date);

    const [newPrice] = await db.insert(productPrices).values({
      variant_id: input.variant_id,
      price_type: input.price_type,
      price: input.price.toString(),
      start_date: input.start_date ? new Date(input.start_date) : null,
      end_date: input.end_date ? new Date(input.end_date) : null,
    }).$returningId();

    if (!newPrice) {
      throw new Error('Failed to create product price');
    }

    // Get the created price
    const [createdPrice] = await dbRead
      .select()
      .from(productPrices)
      .where(eq(productPrices.id, newPrice.id));

    if (!createdPrice) {
      throw new Error('Failed to retrieve created product price');
    }

    return createdPrice;
  } catch (error: any) {
    console.error('Create product price error:', error);

    if (
      error instanceof Error &&
      (error.message === 'Variant tidak ditemukan' || error.message.includes('overlap'))
    ) {
      throw error;
    }

    throw new Error('Gagal membuat harga produk');
  }
}

export async function getProductPrices(filters: GetProductPricesFilters = {}) {
  const page = filters.page || 1;
  const limit = filters.limit || 10;
  const offset = (page - 1) * limit;

  try {
    let whereConditions = [];

    if (filters.variant_id !== undefined) {
      whereConditions.push(eq(productPrices.variant_id, filters.variant_id));
    }

    if (filters.price_type !== undefined) {
      whereConditions.push(eq(productPrices.price_type, filters.price_type));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Get total count
    const countResult = await dbRead
      .select({ count: sql<number>`count(*)` })
      .from(productPrices)
      .where(whereClause);

    const count = countResult[0]?.count || 0;

    // Get paginated prices
    const priceList = await dbRead
      .select()
      .from(productPrices)
      .where(whereClause)
      .orderBy(desc(productPrices.id))
      .limit(limit)
      .offset(offset);

    return {
      data: priceList,
      meta: {
        total: count,
        page,
        limit,
      },
    };
  } catch (error: any) {
    console.error('Get product prices error:', error);
    throw new Error('Gagal mengambil data harga produk');
  }
}

export async function getProductPriceById(id: number) {
  try {
    const [price] = await dbRead
      .select()
      .from(productPrices)
      .where(eq(productPrices.id, id));

    if (!price) {
      throw new Error('Harga tidak ditemukan');
    }

    return price;
  } catch (error: any) {
    console.error('Get product price by ID error:', error);

    if (error instanceof Error && error.message === 'Harga tidak ditemukan') {
      throw error;
    }

    throw new Error('Gagal mengambil data harga produk');
  }
}

export async function getActiveProductPrices(filters: Omit<GetProductPricesFilters, 'page' | 'limit'> = {}) {
  try {
    const now = new Date();

    let whereConditions = [
      or(
        isNull(productPrices.start_date),
        lte(productPrices.start_date, now)
      ),
      or(
        isNull(productPrices.end_date),
        gte(productPrices.end_date, now)
      )
    ];

    if (filters.variant_id !== undefined) {
      whereConditions.push(eq(productPrices.variant_id, filters.variant_id));
    }

    if (filters.price_type !== undefined) {
      whereConditions.push(eq(productPrices.price_type, filters.price_type));
    }

    const whereClause = and(...whereConditions);

    const activePrices = await dbRead
      .select()
      .from(productPrices)
      .where(whereClause)
      .orderBy(asc(productPrices.variant_id), asc(productPrices.price_type));

    return {
      data: activePrices,
    };
  } catch (error: any) {
    console.error('Get active product prices error:', error);
    throw new Error('Gagal mengambil data harga aktif');
  }
}

export async function updateProductPrice(id: number, input: UpdateProductPriceInput) {
  // Input validation
  if (input.price !== undefined && input.price <= 0) {
    throw new Error('Price must be greater than 0');
  }
  if (input.start_date && input.end_date && new Date(input.start_date) >= new Date(input.end_date)) {
    throw new Error('start_date must be before end_date');
  }

  try {
    // Check if price exists
    const [existingPrice] = await dbRead
      .select()
      .from(productPrices)
      .where(eq(productPrices.id, id));

    if (!existingPrice) {
      throw new Error('Harga tidak ditemukan');
    }

    // Check for overlap, excluding self
    const startDate = input.start_date !== undefined ? input.start_date : existingPrice.start_date?.toISOString();
    const endDate = input.end_date !== undefined ? input.end_date : existingPrice.end_date?.toISOString();
    await checkOverlap(existingPrice.variant_id, existingPrice.price_type, startDate, endDate, id);

    // Prepare update data
    const updateData: any = {};

    if (input.price !== undefined) {
      updateData.price = input.price.toString();
    }
    if (input.start_date !== undefined) {
      updateData.start_date = input.start_date ? new Date(input.start_date) : null;
    }
    if (input.end_date !== undefined) {
      updateData.end_date = input.end_date ? new Date(input.end_date) : null;
    }

    // Perform partial update
    await db.update(productPrices).set(updateData).where(eq(productPrices.id, id));

    return 'OK';
  } catch (error: any) {
    console.error('Update product price error:', error);

    if (
      error instanceof Error &&
      (error.message === 'Harga tidak ditemukan' || error.message.includes('overlap'))
    ) {
      throw error;
    }

    throw new Error('Gagal memperbarui harga produk');
  }
}

export async function deleteProductPrice(id: number) {
  try {
    // Check if price exists
    const [existingPrice] = await dbRead
      .select()
      .from(productPrices)
      .where(eq(productPrices.id, id));

    if (!existingPrice) {
      throw new Error('Harga tidak ditemukan');
    }

    await db.delete(productPrices).where(eq(productPrices.id, id));

    return 'OK';
  } catch (error: any) {
    console.error('Delete product price error:', error);

    if (error instanceof Error && error.message === 'Harga tidak ditemukan') {
      throw error;
    }

    throw new Error('Gagal menghapus harga produk');
  }
}

async function checkOverlap(variant_id: number, price_type: string, startDate?: string, endDate?: string, excludeId?: number) {
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;

  // Query existing prices for same variant and type
  let query = dbRead
    .select()
    .from(productPrices)
    .where(and(
      eq(productPrices.variant_id, variant_id),
      eq(productPrices.price_type, price_type)
    ));

  if (excludeId) {
    query = query.where(sql`${productPrices.id} != ${excludeId}`);
  }

  const existingPrices = await query;

  for (const existing of existingPrices) {
    const existingStart = existing.start_date;
    const existingEnd = existing.end_date;

    // Overlap if:
    // (start <= existingEnd or existingEnd is null) and (end >= existingStart or existingStart is null)
    const overlap = (
      (start === null || existingEnd === null || start <= existingEnd) &&
      (existingStart === null || end === null || existingStart <= end)
    );

    if (overlap) {
      throw new Error('Sudah ada harga untuk tipe dan rentang tanggal ini');
    }
  }
}