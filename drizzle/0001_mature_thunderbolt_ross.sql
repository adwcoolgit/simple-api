CREATE TABLE `product_images` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`variant_id` bigint,
	`image_url` varchar(255),
	`is_primary` boolean NOT NULL DEFAULT false,
	CONSTRAINT `product_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `product_images` ADD CONSTRAINT `product_images_variant_id_product_variants_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE no action ON UPDATE no action;