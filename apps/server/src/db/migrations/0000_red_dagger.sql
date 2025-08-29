CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `stock_daily` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ts_code` text NOT NULL,
	`trade_date` text NOT NULL,
	`open` real NOT NULL,
	`high` real NOT NULL,
	`low` real NOT NULL,
	`close` real NOT NULL,
	`vol` real DEFAULT 0,
	`amount` real DEFAULT 0,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`ts_code`) REFERENCES `stocks`(`ts_code`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stock_daily_ts_code_trade_date_idx` ON `stock_daily` (`ts_code`,`trade_date`);--> statement-breakpoint
CREATE INDEX `stock_daily_trade_date_idx` ON `stock_daily` (`trade_date`);--> statement-breakpoint
CREATE INDEX `stock_daily_ts_code_idx` ON `stock_daily` (`ts_code`);--> statement-breakpoint
CREATE INDEX `stock_daily_ts_code_date_range_idx` ON `stock_daily` (`ts_code`,`trade_date`);--> statement-breakpoint
CREATE TABLE `stocks` (
	`ts_code` text PRIMARY KEY NOT NULL,
	`symbol` text NOT NULL,
	`name` text NOT NULL,
	`area` text,
	`industry` text,
	`market` text,
	`list_date` text,
	`is_hs` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `stocks_symbol_idx` ON `stocks` (`symbol`);--> statement-breakpoint
CREATE INDEX `stocks_name_idx` ON `stocks` (`name`);--> statement-breakpoint
CREATE INDEX `stocks_industry_idx` ON `stocks` (`industry`);--> statement-breakpoint
CREATE INDEX `stocks_market_idx` ON `stocks` (`market`);--> statement-breakpoint
CREATE INDEX `stocks_industry_market_idx` ON `stocks` (`industry`,`market`);--> statement-breakpoint
CREATE TABLE `user_stock_favorites` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`ts_code` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`ts_code`) REFERENCES `stocks`(`ts_code`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_stock_favorites_user_ts_code_idx` ON `user_stock_favorites` (`user_id`,`ts_code`);--> statement-breakpoint
CREATE INDEX `user_stock_favorites_user_id_idx` ON `user_stock_favorites` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_stock_favorites_ts_code_idx` ON `user_stock_favorites` (`ts_code`);