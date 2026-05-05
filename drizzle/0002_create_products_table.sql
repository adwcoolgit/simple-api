-- Create products table with new schema (product_id and product_name)
-- Uses IF NOT EXISTS to avoid conflicts

CREATE TABLE IF NOT EXISTS `products` (
    `product_id` bigint AUTO_INCREMENT PRIMARY KEY NOT NULL,
    `product_name` varchar(255) NOT NULL,
    `description` varchar(255),
    `category_id` bigint,
    `department_id` smallint,
    `is_active` tinyint(1) NOT NULL DEFAULT 1,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);