CREATE TABLE `variant_attributes` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`variant_id` bigint NOT NULL,
	`attribute_name` varchar(50),
	`attribute_value` varchar(50),
	CONSTRAINT `variant_attributes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `variant_attributes` ADD CONSTRAINT `variant_attributes_variant_id_product_variants_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE no action ON UPDATE no action;