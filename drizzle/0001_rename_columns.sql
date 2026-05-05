-- WARNING: This migration will DROP existing products table and recreate it
-- Make sure to backup data before running in production!

DROP TABLE IF EXISTS `products`;
--> statement-breakpoint
CREATE TABLE `products` (
    `product_id` bigint AUTO_INCREMENT PRIMARY KEY NOT NULL,
    `product_name` varchar(255) NOT NULL,
    `description` varchar(255),
    `category_id` bigint,
    `department_id` smallint,
    `is_active` tinyint(1) NOT NULL DEFAULT 1,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);