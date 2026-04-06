-- 1. Create the missing product_variants table
CREATE TABLE IF NOT EXISTS `product_variants` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `variant_name` varchar(255) NOT NULL,
  `price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `stock` int(11) NOT NULL DEFAULT 100,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Ensure products table has the is_available column (if missing)
ALTER TABLE `products` 
ADD COLUMN IF NOT EXISTS `is_available` tinyint(1) DEFAULT '1' AFTER `image_url`;

-- 3. Optional: Add a sample product if table is empty
-- INSERT INTO products (name, description, price, unit, category, is_available) 
-- VALUES ('Sample Milk', 'Fresh Dairy Milk', 60.00, '1L', 'Milk', 1);
