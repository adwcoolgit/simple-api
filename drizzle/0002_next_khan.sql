CREATE TABLE `barcodes` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`variant_id` bigint NOT NULL,
	`barcode` varchar(50) NOT NULL,
	CONSTRAINT `barcodes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `barcodes` ADD CONSTRAINT `barcodes_variant_id_product_variants_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE no action ON UPDATE no action;