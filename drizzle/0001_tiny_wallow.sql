CREATE TABLE `product_taxes` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`variant_id` bigint NOT NULL,
	`tax_code` varchar(20),
	`is_inclusive` boolean NOT NULL DEFAULT false,
	CONSTRAINT `product_taxes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `product_taxes` ADD CONSTRAINT `product_taxes_variant_id_product_variants_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE no action ON UPDATE no action;