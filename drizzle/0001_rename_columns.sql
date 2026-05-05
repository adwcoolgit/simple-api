-- WARNING: This migration will DROP existing products table and recreate it
-- Make sure to backup data before running in production!

-- Drop existing table (will lose data - backup first!)
DROP TABLE IF EXISTS `products`;

-- Create products table with new schema (product_id and product_name)
CREATE TABLE `products` (
    `product_id` bigint AUTO_INCREMENT NOT NULL,
    `product_name` varchar(255) NOT NULL,
    `description` varchar(255),
    `category_id` bigint,
    `department_id` smallint,
    `is_active` boolean NOT NULL DEFAULT true,
    `created_at` timestamp NOT NULL DEFAULT (now()),
    `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `products_product_id` PRIMARY KEY(`product_id`)
);