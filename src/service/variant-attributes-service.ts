import { variantAttributes, productVariants } from '../db/schema';
import { db, dbRead } from '../db';
import { eq } from 'drizzle-orm';

export interface CreateVariantAttributeInput {
  variantId: number;
  attributeName: string;
  attributeValue: string;
}

export interface UpdateVariantAttributeInput {
  attributeName?: string;
  attributeValue?: string;
}

export async function createVariantAttribute(input: CreateVariantAttributeInput) {
  // Input validation
  if (!input.attributeName || input.attributeName.trim().length === 0) {
    throw new Error('attribute_name is required');
  }
  if (input.attributeName.length > 50) {
    throw new Error('Attribute name is too long, maximum 50 characters');
  }
  if (!input.attributeValue || input.attributeValue.trim().length === 0) {
    throw new Error('attribute_value is required');
  }
  if (input.attributeValue.length > 50) {
    throw new Error('Attribute value is too long, maximum 50 characters');
  }

  try {
    // Check if variant exists
    const [existingVariant] = await dbRead
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, input.variantId));

    if (!existingVariant) {
      throw new Error('Variant not found');
    }

    const [newAttribute] = await db.insert(variantAttributes).values({
      variantId: input.variantId,
      attributeName: input.attributeName,
      attributeValue: input.attributeValue,
    }).$returningId();

    if (!newAttribute) {
      throw new Error('Failed to create variant attribute');
    }

    // Get the created attribute
    const [createdAttribute] = await dbRead
      .select()
      .from(variantAttributes)
      .where(eq(variantAttributes.id, newAttribute.id));

    if (!createdAttribute) {
      throw new Error('Failed to retrieve created variant attribute');
    }

    return createdAttribute;
  } catch (error: any) {
    console.error('Create variant attribute error:', error);

    // Handle database constraint violation
    if (
      error?.message?.includes('varchar') ||
      error?.message?.includes('length') ||
      error?.code === 'ER_DATA_TOO_LONG' ||
      error?.message?.includes('Data too long')
    ) {
      throw new Error('Input is too long');
    }

    if (error instanceof Error && error.message === 'Variant not found') {
      throw error;
    }

    throw new Error('Failed to create variant attribute');
  }
}

export async function getVariantAttributes(variantId: number) {
  try {
    // Check if variant exists
    const [existingVariant] = await dbRead
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, variantId));

    if (!existingVariant) {
      throw new Error('Variant not found');
    }

    const attributes = await dbRead
      .select()
      .from(variantAttributes)
      .where(eq(variantAttributes.variantId, variantId));

    return attributes;
  } catch (error: any) {
    console.error('Get variant attributes error:', error);

    if (error instanceof Error && error.message === 'Variant not found') {
      throw error;
    }

    throw new Error('Failed to retrieve variant attributes');
  }
}

export async function getVariantAttributeById(id: number) {
  try {
    const [attribute] = await dbRead
      .select()
      .from(variantAttributes)
      .where(eq(variantAttributes.id, id));

    if (!attribute) {
      throw new Error('Attribute not found');
    }

    return attribute;
  } catch (error: any) {
    console.error('Get variant attribute by ID error:', error);

    if (error instanceof Error && error.message === 'Attribute not found') {
      throw error;
    }

    throw new Error('Failed to retrieve variant attribute');
  }
}

export async function updateVariantAttribute(id: number, input: UpdateVariantAttributeInput) {
  // Input validation
  if (input.attributeName !== undefined) {
    if (!input.attributeName || input.attributeName.trim().length === 0) {
      throw new Error('attribute_name is required');
    }
    if (input.attributeName.length > 50) {
      throw new Error('Attribute name is too long, maximum 50 characters');
    }
  }
  if (input.attributeValue !== undefined) {
    if (!input.attributeValue || input.attributeValue.trim().length === 0) {
      throw new Error('attribute_value is required');
    }
    if (input.attributeValue.length > 50) {
      throw new Error('Attribute value is too long, maximum 50 characters');
    }
  }

  try {
    // Check if attribute exists
    const [existingAttribute] = await dbRead
      .select()
      .from(variantAttributes)
      .where(eq(variantAttributes.id, id));

    if (!existingAttribute) {
      throw new Error('Attribute not found');
    }

    // Prepare update data
    const updateData: any = {};

    if (input.attributeName !== undefined) {
      updateData.attributeName = input.attributeName;
    }
    if (input.attributeValue !== undefined) {
      updateData.attributeValue = input.attributeValue;
    }

    // Perform partial update
    await db.update(variantAttributes).set(updateData).where(eq(variantAttributes.id, id));

    // Return updated attribute
    const [updatedAttribute] = await dbRead
      .select()
      .from(variantAttributes)
      .where(eq(variantAttributes.id, id));

    if (!updatedAttribute) {
      throw new Error('Failed to retrieve updated variant attribute');
    }

    return updatedAttribute;
  } catch (error: any) {
    console.error('Update variant attribute error:', error);

    // Handle database constraint violation
    if (
      error?.message?.includes('varchar') ||
      error?.message?.includes('length') ||
      error?.code === 'ER_DATA_TOO_LONG' ||
      error?.message?.includes('Data too long')
    ) {
      throw new Error('Input is too long');
    }

    if (error instanceof Error && error.message === 'Attribute not found') {
      throw error;
    }

    throw new Error('Failed to update variant attribute');
  }
}

export async function deleteVariantAttribute(id: number) {
  try {
    // Check if attribute exists
    const [existingAttribute] = await dbRead
      .select()
      .from(variantAttributes)
      .where(eq(variantAttributes.id, id));

    if (!existingAttribute) {
      throw new Error('Attribute not found');
    }

    // Delete the attribute
    await db.delete(variantAttributes).where(eq(variantAttributes.id, id));
  } catch (error: any) {
    console.error('Delete variant attribute error:', error);

    if (error instanceof Error && error.message === 'Attribute not found') {
      throw error;
    }

    throw new Error('Failed to delete variant attribute');
  }
}