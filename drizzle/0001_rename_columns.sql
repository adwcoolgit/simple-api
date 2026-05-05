ALTER TABLE `products` CHANGE COLUMN `plu_no` `product_id` bigint AUTO_INCREMENT NOT NULL;
--> statement-breakpoint
ALTER TABLE `products` CHANGE COLUMN `plu_name` `product_name` varchar(255) NOT NULL;