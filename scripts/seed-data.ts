import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

async function seedData() {
  const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'rootpassword',
    database: process.env.DB_NAME || 'simple_api',
    multipleStatements: true,
  };

  const connection = await mysql.createConnection(dbConfig);

  try {
    // Delete data - truncate in dependency order
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0;');
    await connection.execute('TRUNCATE TABLE inventory;');
    await connection.execute('TRUNCATE TABLE product_taxes;');
    await connection.execute('TRUNCATE TABLE barcodes;');
    await connection.execute('TRUNCATE TABLE product_images;');
    await connection.execute('TRUNCATE TABLE product_costs;');
    await connection.execute('TRUNCATE TABLE product_prices;');
    await connection.execute('TRUNCATE TABLE variant_attributes;');
    await connection.execute('TRUNCATE TABLE product_variants;');
    await connection.execute('TRUNCATE TABLE products;');
    await connection.execute('TRUNCATE TABLE warehouses;');
    await connection.execute('TRUNCATE TABLE sessions;');
    await connection.execute('TRUNCATE TABLE users;');
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1;');

    console.log('Data deleted from all tables.');

    // Insert 10+ realistic interrelated entries per table
    const passwordHash = await bcrypt.hash('password123', 10);
    await connection.execute(`INSERT INTO users (name, email, password) VALUES 
      ('John Doe', 'john@acme.com', '${passwordHash}'), ('Jane Smith', 'jane@acme.com', '${passwordHash}'),
      ('Alice Johnson', 'alice@tech.com', '${passwordHash}'), ('Bob Wilson', 'bob@retail.com', '${passwordHash}'),
      ('Carol Davis', 'carol@supply.com', '${passwordHash}'), ('David Brown', 'david@logistics.com', '${passwordHash}'),
      ('Emma Taylor', 'emma@store.com', '${passwordHash}'), ('Frank Miller', 'frank@wholesale.com', '${passwordHash}'),
      ('Grace Lee', 'grace@dist.com', '${passwordHash}'), ('Henry Clark', 'henry@biz.com', '${passwordHash}');`);

    await connection.execute(`INSERT INTO warehouses (name, address) VALUES 
      ('Main Warehouse', '123 Industrial Rd, City A'), ('East Distribution Hub', '456 Commerce Blvd, City B'),
      ('West Fulfillment Center', '789 Logistics Way, City C'), ('North Storage Facility', '321 Supply St, City D'),
      ('South Regional Depot', '654 Warehouse Ln, City E'), ('Central Hub', '987 Central Ave, City F'),
      ('Airport Cargo', '147 Runway Rd, City G'), ('Port Terminal', '258 Dock St, City H'),
      ('Retail Outlet Store', '369 Shop Ave, City I'), ('Backup Archive', '741 Backup Blvd, City J');`);

    await connection.execute(`INSERT INTO products (name, description, category_id, department_id) VALUES 
      ('Laptop Pro X1', '15-inch high-performance laptop', 1, 10), ('Wireless Ergonomic Mouse', 'Bluetooth optical mouse', 2, 10),
      ('USB-C Hub 7-in-1', 'Multiport adapter', 3, 10), ('Mechanical Keyboard RGB', 'Full-size gaming keyboard', 2, 10),
      ('27-inch 4K Monitor', 'IPS display with HDR', 1, 10), ('Noise Cancelling Headphones', 'Over-ear wireless', 4, 20),
      ('Portable SSD 1TB', 'External solid state drive', 5, 10), ('Webcam 1080p HD', 'USB plug-and-play camera', 6, 20),
      ('Standing Desk Converter', 'Height adjustable riser', 7, 30), ('LED Desk Lamp', 'Dimmable smart light', 8, 30);`);

    await connection.execute(`INSERT INTO product_variants (product_id, sku, variant_name, uom, is_active) VALUES 
      (1,'LAPTOP-X1-16','16GB/512GB','pcs',true), (1,'LAPTOP-X1-32','32GB/1TB','pcs',true),
      (2,'MOUSE-ERG-BLK','Black','pcs',true), (2,'MOUSE-ERG-WHT','White','pcs',true),
      (3,'HUB-USBC-7IN1','Standard','pcs',true), (4,'KEY-MECH-RGB','RGB Backlit','pcs',true),
      (5,'MON-27-4K','IPS 4K','pcs',true), (6,'HEAD-NC-PRO','Pro Model','pcs',true),
      (7,'SSD-1TB-PORT','Portable','pcs',true), (8,'CAM-1080-USB','HD Webcam','pcs',true),
      (9,'DESK-STAND-ADJ','Adjustable','pcs',true), (10,'LAMP-LED-SMART','Smart WiFi','pcs',true);`);

    await connection.execute(`INSERT INTO variant_attributes (variant_id, attribute_name, attribute_value) VALUES 
      (1,'Color','Space Gray'), (1,'RAM','16GB'), (2,'Color','Silver'), (2,'Storage','1TB'),
      (3,'Color','Black'), (4,'Color','White'), (5,'Ports','7'), (6,'Switches','Cherry MX'),
      (7,'Resolution','3840x2160'), (8,'ANC','Active Noise Cancel'), (9,'Capacity','1TB'),
      (10,'Resolution','1080p'), (11,'Height Range','10-50cm'), (12,'Connectivity','WiFi+App');`);

    await connection.execute(`INSERT INTO product_prices (variant_id, price_type, price) VALUES 
      (1,'retail',1499.99),(1,'member',1399.99),(1,'reseller',1299.99),
      (2,'retail',1699.99),(3,'retail',39.99),(4,'retail',44.99),
      (5,'retail',59.99),(6,'retail',129.99),(7,'retail',599.99),
      (8,'retail',249.99),(9,'retail',179.99),(10,'retail',69.99),
      (11,'retail',299.99),(12,'retail',49.99);`);

    await connection.execute(`INSERT INTO product_costs (variant_id, cost_price, effective_date) VALUES 
      (1,1050.00,'2025-01-01'), (2,1200.00,'2025-01-01'), (3,22.50,'2025-02-01'),
      (4,28.00,'2025-02-01'), (5,35.00,'2025-03-01'), (6,85.00,'2025-03-01'),
      (7,420.00,'2025-04-01'), (8,160.00,'2025-04-01'), (9,95.00,'2025-05-01'),
      (10,42.00,'2025-05-01'), (11,185.00,'2025-06-01'), (12,28.00,'2025-06-01');`);

    await connection.execute(`INSERT INTO barcodes (variant_id, barcode) VALUES 
      (1,'5901234123457'),(2,'5901234123464'),(3,'5901234123471'),(4,'5901234123488'),
      (5,'5901234123495'),(6,'5901234123501'),(7,'5901234123518'),(8,'5901234123525'),
      (9,'5901234123532'),(10,'5901234123549'),(11,'5901234123556'),(12,'5901234123563');`);

    await connection.execute(`INSERT INTO product_taxes (variant_id, tax_code, is_inclusive) VALUES 
      (1,'VAT20',true),(2,'VAT20',true),(3,'VAT20',false),(4,'VAT20',false),
      (5,'VAT20',true),(6,'VAT20',true),(7,'VAT20',false),(8,'VAT20',false),
      (9,'VAT20',true),(10,'VAT20',true),(11,'VAT20',false),(12,'VAT20',false);`);

    await connection.execute(`INSERT INTO product_images (variant_id, image_url, is_primary) VALUES 
      (1,'https://cdn.acme.com/laptop-x1-gray.jpg',true),(2,'https://cdn.acme.com/laptop-x1-silver.jpg',true),
      (3,'https://cdn.acme.com/mouse-black.jpg',true),(4,'https://cdn.acme.com/mouse-white.jpg',true),
      (5,'https://cdn.acme.com/hub-7in1.jpg',true),(6,'https://cdn.acme.com/keyboard-rgb.jpg',true),
      (7,'https://cdn.acme.com/monitor-27-4k.jpg',true),(8,'https://cdn.acme.com/headphones-pro.jpg',true),
      (9,'https://cdn.acme.com/ssd-1tb.jpg',true),(10,'https://cdn.acme.com/webcam-1080.jpg',true),
      (11,'https://cdn.acme.com/desk-stand.jpg',true),(12,'https://cdn.acme.com/lamp-smart.jpg',true);`);

    await connection.execute(`INSERT INTO inventory (variant_id, warehouse_id, stock_qty, reserved_qty, min_stock, max_stock) VALUES 
      (1,1,120,15,50,300),(2,1,85,10,30,200),(3,2,450,50,100,1000),
      (4,2,380,40,80,800),(5,3,210,25,60,500),(6,3,95,12,40,250),
      (7,4,65,8,20,150),(8,4,140,18,50,400),(9,5,55,7,25,120),
      (10,5,320,35,100,700),(11,6,75,9,30,200),(12,6,180,22,60,350);`);

    await connection.execute(`INSERT INTO sessions (token, user_id) VALUES 
      ('sess_tok_001',1),('sess_tok_002',2),('sess_tok_003',3),('sess_tok_004',4),
      ('sess_tok_005',5),('sess_tok_006',6),('sess_tok_007',7),('sess_tok_008',8),
      ('sess_tok_009',9),('sess_tok_010',10);`);

    console.log('Each table now has 10+ realistic interrelated entries.');
  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    await connection.end();
  }
}

await seedData();