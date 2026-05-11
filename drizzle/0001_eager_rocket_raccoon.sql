ALTER TABLE `products` ADD `name` varchar(255) NOT NULL;--> statement-breakpoint
UPDATE `products` SET `name` = `product_name`;--> statement-breakpoint
ALTER TABLE `products` DROP COLUMN `product_name`;