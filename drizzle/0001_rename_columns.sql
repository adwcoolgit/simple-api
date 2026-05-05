-- Check if old columns exist and rename them, otherwise create table with new schema
SET @column_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'products'
    AND COLUMN_NAME = 'plu_no'
);

-- If old columns exist, rename them
SET @sql = IF(@column_exists > 0,
    'ALTER TABLE `products` CHANGE COLUMN `plu_no` `product_id` bigint AUTO_INCREMENT NOT NULL, CHANGE COLUMN `plu_name` `product_name` varchar(255) NOT NULL;',
    'CREATE TABLE IF NOT EXISTS `products` (
        `product_id` bigint AUTO_INCREMENT NOT NULL,
        `product_name` varchar(255) NOT NULL,
        `description` varchar(255),
        `category_id` bigint,
        `department_id` smallint,
        `is_active` boolean NOT NULL DEFAULT true,
        `created_at` timestamp NOT NULL DEFAULT (now()),
        `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT `products_product_id` PRIMARY KEY(`product_id`)
    );'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;