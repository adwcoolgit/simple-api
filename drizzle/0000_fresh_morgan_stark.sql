CREATE TABLE `product_prices` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`variant_id` bigint NOT NULL,
	`price_type` enum('retail','member','reseller') NOT NULL,
	`price` decimal(12,2) NOT NULL,
	`start_date` datetime,
	`end_date` datetime,
	CONSTRAINT `product_prices_id` PRIMARY KEY(`id`)
);

--> statement-breakpoint

CREATE TABLE `product_variants` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`product_id` bigint NOT NULL,
	`sku` varchar(50) NOT NULL,
	`variant_name` varchar(100),
	`uom` varchar(10),
	`is_active` boolean NOT NULL DEFAULT true,
	`is_sellable` boolean NOT NULL DEFAULT true,
	CONSTRAINT `product_variants_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_variants_sku_unique` UNIQUE(`sku`)
);

--> statement-breakpoint

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

--> statement-breakpoint

CREATE TABLE `sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(255) NOT NULL,
	`user_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);

--> statement-breakpoint

CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);

--> statement-breakpoint

CREATE TABLE `variant_attributes` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`variant_id` bigint NOT NULL,
	`attribute_name` varchar(50),
	`attribute_value` varchar(50),
	CONSTRAINT `variant_attributes_id` PRIMARY KEY(`id`)
);

--> statement-breakpoint

ALTER TABLE `product_prices` ADD CONSTRAINT `product_prices_variant_id_product_variants_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE no action ON UPDATE no action;

--> statement-breakpoint

ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_product_id_products_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`product_id`) ON DELETE no action ON UPDATE no action;

--> statement-breakpoint

ALTER TABLE `variant_attributes` ADD CONSTRAINT `variant_attributes_variant_id_product_variants_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE no action ON UPDATE no action;