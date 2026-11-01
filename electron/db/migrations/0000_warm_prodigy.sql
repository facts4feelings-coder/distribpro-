CREATE TABLE `activations` (
	`id` text PRIMARY KEY NOT NULL,
	`license_id` text NOT NULL,
	`device_id` text NOT NULL,
	`device_name` text,
	`activated_at` text NOT NULL,
	FOREIGN KEY (`license_id`) REFERENCES `licenses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `app_users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`email` text,
	`password_hash` text NOT NULL,
	`salt` text NOT NULL,
	`recovery_question` text,
	`recovery_answer_hash` text,
	`last_login` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_users_username_unique` ON `app_users` (`username`);--> statement-breakpoint
CREATE TABLE `backup_history` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`kind` text DEFAULT 'download' NOT NULL,
	`file_name` text,
	`size_bytes` integer,
	`table_counts` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `customer_invoice_items` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`product_id` text,
	`product_name` text NOT NULL,
	`quantity` integer DEFAULT 1000 NOT NULL,
	`unit_price` integer DEFAULT 0 NOT NULL,
	`discount_percent` integer DEFAULT 0 NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`created_at` text,
	FOREIGN KEY (`invoice_id`) REFERENCES `customer_invoices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `customer_invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_no` text NOT NULL,
	`customer_id` text NOT NULL,
	`invoice_date` text NOT NULL,
	`due_date` text,
	`subtotal` integer DEFAULT 0 NOT NULL,
	`discount` integer DEFAULT 0 NOT NULL,
	`tax` integer DEFAULT 0 NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`paid_amount` integer DEFAULT 0 NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'unpaid' NOT NULL,
	`invoice_type` text DEFAULT 'sale' NOT NULL,
	`payment_type` text DEFAULT 'credit' NOT NULL,
	`notes` text,
	`created_at` text,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_customer_invoices_customer_id` ON `customer_invoices` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_customer_invoices_date` ON `customer_invoices` (`invoice_date`);--> statement-breakpoint
CREATE TABLE `customer_routes` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`route_id` text NOT NULL,
	`created_at` text,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`route_id`) REFERENCES `routes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`address` text,
	`city` text,
	`opening_balance` integer DEFAULT 0 NOT NULL,
	`current_balance` integer DEFAULT 0 NOT NULL,
	`balance_type` text DEFAULT 'receivable' NOT NULL,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`address` text,
	`position` text,
	`salary` integer DEFAULT 0 NOT NULL,
	`hire_date` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `expense_vouchers` (
	`id` text PRIMARY KEY NOT NULL,
	`voucher_no` text NOT NULL,
	`expense_date` text NOT NULL,
	`category` text NOT NULL,
	`description` text,
	`amount` integer DEFAULT 0 NOT NULL,
	`paid_to` text,
	`created_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_expense_vouchers_date` ON `expense_vouchers` (`expense_date`);--> statement-breakpoint
CREATE TABLE `gate_passes` (
	`id` text PRIMARY KEY NOT NULL,
	`pass_no` text NOT NULL,
	`pass_type` text DEFAULT 'sales' NOT NULL,
	`customer_id` text,
	`customer_name` text NOT NULL,
	`pass_date` text NOT NULL,
	`reference_invoice` text,
	`items_description` text,
	`total_amount` integer DEFAULT 0 NOT NULL,
	`vehicle_no` text,
	`driver_name` text,
	`notes` text,
	`created_at` text,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_gate_passes_date` ON `gate_passes` (`pass_date`);--> statement-breakpoint
CREATE TABLE `income_options` (
	`id` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`income_date` text NOT NULL,
	`category` text DEFAULT 'Other' NOT NULL,
	`reference` text,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `licenses` (
	`id` text PRIMARY KEY NOT NULL,
	`license_key` text NOT NULL,
	`customer_name` text DEFAULT '' NOT NULL,
	`max_devices` integer DEFAULT 1 NOT NULL,
	`expires_at` text,
	`is_active` integer DEFAULT true NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `licenses_license_key_unique` ON `licenses` (`license_key`);--> statement-breakpoint
CREATE TABLE `payment_vouchers` (
	`id` text PRIMARY KEY NOT NULL,
	`voucher_no` text NOT NULL,
	`customer_id` text,
	`supplier_id` text,
	`voucher_date` text NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`payment_method` text DEFAULT 'cash' NOT NULL,
	`reference` text,
	`notes` text,
	`created_at` text,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "payment_vouchers_one_payee" CHECK(("payment_vouchers"."customer_id" IS NOT NULL AND "payment_vouchers"."supplier_id" IS NULL) OR ("payment_vouchers"."customer_id" IS NULL AND "payment_vouchers"."supplier_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `idx_payment_vouchers_customer_id` ON `payment_vouchers` (`customer_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sku` text,
	`category` text,
	`unit` text DEFAULT 'pcs' NOT NULL,
	`purchase_price` integer DEFAULT 0 NOT NULL,
	`sale_price` integer DEFAULT 0 NOT NULL,
	`stock_quantity` integer DEFAULT 0 NOT NULL,
	`reorder_level` integer DEFAULT 0 NOT NULL,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `routes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`day_of_week` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `salary_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`payment_date` text NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`month` text NOT NULL,
	`payment_method` text DEFAULT 'cash' NOT NULL,
	`notes` text,
	`created_at` text,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_salary_payments_employee` ON `salary_payments` (`employee_id`);--> statement-breakpoint
CREATE TABLE `salesman_targets` (
	`id` text PRIMARY KEY NOT NULL,
	`salesman_name` text NOT NULL,
	`route_id` text,
	`target_month` text NOT NULL,
	`target_amount` integer DEFAULT 0 NOT NULL,
	`created_at` text,
	FOREIGN KEY (`route_id`) REFERENCES `routes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_salesman_targets` ON `salesman_targets` (`salesman_name`,`target_month`,`route_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`company_name` text DEFAULT 'My Distribution Company' NOT NULL,
	`company_address` text,
	`company_phone` text,
	`company_email` text,
	`currency_symbol` text DEFAULT 'Rs' NOT NULL,
	`tax_rate` integer DEFAULT 0 NOT NULL,
	`invoice_prefix` text DEFAULT 'INV-' NOT NULL,
	`supplier_invoice_prefix` text DEFAULT 'SUP-' NOT NULL,
	`payment_voucher_prefix` text DEFAULT 'PV-' NOT NULL,
	`expense_voucher_prefix` text DEFAULT 'EV-' NOT NULL,
	`gate_pass_prefix` text DEFAULT 'GP-' NOT NULL,
	`sales_return_prefix` text DEFAULT 'SR-' NOT NULL,
	`purchase_return_prefix` text DEFAULT 'PR-' NOT NULL,
	`default_print_format` text DEFAULT 'a4' NOT NULL,
	`thermal_printer_width` text DEFAULT '80mm' NOT NULL,
	`invoice_footer_note` text DEFAULT 'Thank you for your business!' NOT NULL,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `supplier_invoice_items` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`product_id` text,
	`product_name` text NOT NULL,
	`quantity` integer DEFAULT 1000 NOT NULL,
	`unit_price` integer DEFAULT 0 NOT NULL,
	`discount_percent` integer DEFAULT 0 NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`created_at` text,
	FOREIGN KEY (`invoice_id`) REFERENCES `supplier_invoices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `supplier_invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_no` text NOT NULL,
	`supplier_id` text NOT NULL,
	`invoice_date` text NOT NULL,
	`due_date` text,
	`subtotal` integer DEFAULT 0 NOT NULL,
	`discount` integer DEFAULT 0 NOT NULL,
	`tax` integer DEFAULT 0 NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`paid_amount` integer DEFAULT 0 NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'unpaid' NOT NULL,
	`invoice_type` text DEFAULT 'purchase' NOT NULL,
	`notes` text,
	`created_at` text,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_supplier_invoices_supplier_id` ON `supplier_invoices` (`supplier_id`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`address` text,
	`city` text,
	`opening_balance` integer DEFAULT 0 NOT NULL,
	`current_balance` integer DEFAULT 0 NOT NULL,
	`balance_type` text DEFAULT 'payable' NOT NULL,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `user_permissions` (
	`user_id` text PRIMARY KEY NOT NULL,
	`permissions` text DEFAULT '[]' NOT NULL,
	`updated_at` text NOT NULL
);
