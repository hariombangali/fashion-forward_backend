require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Product = require('../models/Product');
const Category = require('../models/Category');

// Free Unsplash image URLs for each category
const IMAGES = {
  Kurti: [
    'https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=800&q=80',
    'https://images.unsplash.com/photo-1610189044667-b24c1a3d3bd7?w=800&q=80',
    'https://images.unsplash.com/photo-1617059062149-c99b5c1a6e64?w=800&q=80',
    'https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?w=800&q=80',
    'https://images.unsplash.com/photo-1594736797933-d0d3085cf6ad?w=800&q=80',
  ],
  Saree: [
    'https://images.unsplash.com/photo-1610189044667-b24c1a3d3bd7?w=800&q=80',
    'https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=800&q=80',
    'https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?w=800&q=80',
    'https://images.unsplash.com/photo-1617059062149-c99b5c1a6e64?w=800&q=80',
    'https://images.unsplash.com/photo-1594736797933-d0d3085cf6ad?w=800&q=80',
  ],
  Shirt: [
    'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&q=80',
    'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800&q=80',
    'https://images.unsplash.com/photo-1598033129183-c4f50c736c10?w=800&q=80',
    'https://images.unsplash.com/photo-1563389234808-52344934935c?w=800&q=80',
    'https://images.unsplash.com/photo-1588359348347-9bc6cbbb689e?w=800&q=80',
  ],
  'T-Shirt': [
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80',
    'https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?w=800&q=80',
    'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&q=80',
    'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&q=80',
    'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=800&q=80',
  ],
  'Jeans & Trousers': [
    'https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&q=80',
    'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800&q=80',
    'https://images.unsplash.com/photo-1604176354204-9268737828e4?w=800&q=80',
    'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&q=80',
    'https://images.unsplash.com/photo-1582552938357-32b906df40cb?w=800&q=80',
  ],
  Lehenga: [
    'https://images.unsplash.com/photo-1594736797933-d0d3085cf6ad?w=800&q=80',
    'https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?w=800&q=80',
    'https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=800&q=80',
    'https://images.unsplash.com/photo-1610189044667-b24c1a3d3bd7?w=800&q=80',
    'https://images.unsplash.com/photo-1617059062149-c99b5c1a6e64?w=800&q=80',
  ],
  'Suit Set': [
    'https://images.unsplash.com/photo-1617059062149-c99b5c1a6e64?w=800&q=80',
    'https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?w=800&q=80',
    'https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=800&q=80',
    'https://images.unsplash.com/photo-1610189044667-b24c1a3d3bd7?w=800&q=80',
    'https://images.unsplash.com/photo-1594736797933-d0d3085cf6ad?w=800&q=80',
  ],
  Dress: [
    'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800&q=80',
    'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&q=80',
    'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=800&q=80',
    'https://images.unsplash.com/photo-1612336307429-8a898d10e223?w=800&q=80',
    'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=800&q=80',
  ],
  'Kids Wear': [
    'https://images.unsplash.com/photo-1519457431-44ccd64a579b?w=800&q=80',
    'https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?w=800&q=80',
    'https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?w=800&q=80',
    'https://images.unsplash.com/photo-1543854589-fdd815f176af?w=800&q=80',
    'https://images.unsplash.com/photo-1471286174890-9c112ffca5b4?w=800&q=80',
  ],
  'Dupatta & Stole': [
    'https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?w=800&q=80',
    'https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=800&q=80',
    'https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?w=800&q=80',
    'https://images.unsplash.com/photo-1610189044667-b24c1a3d3bd7?w=800&q=80',
    'https://images.unsplash.com/photo-1594736797933-d0d3085cf6ad?w=800&q=80',
  ],
};

const PRODUCTS = [
  // ======= KURTI (8 products) =======
  { name: 'Cotton Floral A-Line Kurti', cat: 'Kurti', fabric: 'Cotton', retailPrice: 699, retailMRP: 1299, colors: [{ name: 'Pink', hex: '#EC4899' }, { name: 'Yellow', hex: '#EAB308' }], tags: ['floral', 'casual', 'office'] },
  { name: 'Rayon Embroidered Straight Kurti', cat: 'Kurti', fabric: 'Rayon', retailPrice: 899, retailMRP: 1499, colors: [{ name: 'Maroon', hex: '#800000' }, { name: 'Navy', hex: '#000080' }], tags: ['embroidered', 'party'] },
  { name: 'Georgette Party Wear Kurti', cat: 'Kurti', fabric: 'Georgette', retailPrice: 1299, retailMRP: 2199, colors: [{ name: 'Black', hex: '#000000' }, { name: 'Wine', hex: '#722F37' }], tags: ['party', 'georgette', 'festive'] },
  { name: 'Chiffon Printed Anarkali Kurti', cat: 'Kurti', fabric: 'Chiffon', retailPrice: 999, retailMRP: 1799, colors: [{ name: 'Red', hex: '#DC2626' }, { name: 'Green', hex: '#16A34A' }], tags: ['anarkali', 'printed'] },
  { name: 'Cotton Checks Casual Kurti', cat: 'Kurti', fabric: 'Cotton', retailPrice: 599, retailMRP: 999, colors: [{ name: 'Blue', hex: '#2563EB' }, { name: 'Grey', hex: '#6B7280' }], tags: ['checks', 'casual', 'daily'] },
  { name: 'Silk Blend Designer Kurti', cat: 'Kurti', fabric: 'Silk', retailPrice: 1599, retailMRP: 2999, colors: [{ name: 'Gold', hex: '#D4AF37' }, { name: 'Cream', hex: '#FFFDD0' }], tags: ['designer', 'silk', 'wedding'] },
  { name: 'Linen Summer Kurti', cat: 'Kurti', fabric: 'Linen', retailPrice: 799, retailMRP: 1399, colors: [{ name: 'White', hex: '#FFFFFF' }, { name: 'Beige', hex: '#F5F5DC' }], tags: ['linen', 'summer', 'breathable'] },
  { name: 'Crepe Digital Print Kurti', cat: 'Kurti', fabric: 'Crepe', retailPrice: 849, retailMRP: 1599, colors: [{ name: 'Purple', hex: '#7C3AED' }, { name: 'Teal', hex: '#0D9488' }], tags: ['digital print', 'trendy'] },

  // ======= SAREE (7 products) =======
  { name: 'Banarasi Silk Saree', cat: 'Saree', fabric: 'Silk', retailPrice: 2499, retailMRP: 4999, sizes: ['Free Size'], colors: [{ name: 'Red', hex: '#DC2626' }, { name: 'Green', hex: '#16A34A' }], tags: ['banarasi', 'wedding', 'bridal'] },
  { name: 'Chiffon Printed Daily Wear Saree', cat: 'Saree', fabric: 'Chiffon', retailPrice: 899, retailMRP: 1699, sizes: ['Free Size'], colors: [{ name: 'Blue', hex: '#3B82F6' }, { name: 'Pink', hex: '#EC4899' }], tags: ['daily', 'printed', 'lightweight'] },
  { name: 'Georgette Party Saree', cat: 'Saree', fabric: 'Georgette', retailPrice: 1799, retailMRP: 3499, sizes: ['Free Size'], colors: [{ name: 'Wine', hex: '#722F37' }, { name: 'Teal', hex: '#0D9488' }], tags: ['party', 'sequin', 'glam'] },
  { name: 'Cotton Handloom Saree', cat: 'Saree', fabric: 'Cotton', retailPrice: 1299, retailMRP: 2199, sizes: ['Free Size'], colors: [{ name: 'White', hex: '#FFFFFF' }, { name: 'Indigo', hex: '#312E81' }], tags: ['handloom', 'cotton', 'traditional'] },
  { name: 'Art Silk Kanjeevaram Saree', cat: 'Saree', fabric: 'Silk', retailPrice: 1999, retailMRP: 3999, sizes: ['Free Size'], colors: [{ name: 'Gold', hex: '#D4AF37' }, { name: 'Maroon', hex: '#800000' }], tags: ['kanjeevaram', 'south indian', 'temple'] },
  { name: 'Net Embroidered Saree', cat: 'Saree', fabric: 'Net', retailPrice: 2199, retailMRP: 4499, sizes: ['Free Size'], colors: [{ name: 'Black', hex: '#000000' }, { name: 'Silver', hex: '#C0C0C0' }], tags: ['net', 'embroidered', 'cocktail'] },
  { name: 'Linen Casual Saree', cat: 'Saree', fabric: 'Linen', retailPrice: 1099, retailMRP: 1999, sizes: ['Free Size'], colors: [{ name: 'Beige', hex: '#F5F5DC' }, { name: 'Mustard', hex: '#E2B714' }], tags: ['linen', 'casual', 'summer'] },

  // ======= SHIRT (6 products) =======
  { name: 'Cotton Slim Fit Formal Shirt', cat: 'Shirt', fabric: 'Cotton', retailPrice: 799, retailMRP: 1499, colors: [{ name: 'White', hex: '#FFFFFF' }, { name: 'Sky Blue', hex: '#87CEEB' }], tags: ['formal', 'office', 'slim fit'] },
  { name: 'Linen Casual Shirt', cat: 'Shirt', fabric: 'Linen', retailPrice: 999, retailMRP: 1799, colors: [{ name: 'Olive', hex: '#6B8E23' }, { name: 'Cream', hex: '#FFFDD0' }], tags: ['casual', 'linen', 'weekend'] },
  { name: 'Denim Shirt Washed', cat: 'Shirt', fabric: 'Denim', retailPrice: 1199, retailMRP: 1999, colors: [{ name: 'Light Blue', hex: '#ADD8E6' }, { name: 'Dark Blue', hex: '#191970' }], tags: ['denim', 'washed', 'casual'] },
  { name: 'Oxford Button-Down Shirt', cat: 'Shirt', fabric: 'Cotton', retailPrice: 899, retailMRP: 1599, colors: [{ name: 'Pink', hex: '#FFB6C1' }, { name: 'Lavender', hex: '#E6E6FA' }], tags: ['oxford', 'button-down', 'smart'] },
  { name: 'Checks Regular Fit Shirt', cat: 'Shirt', fabric: 'Cotton', retailPrice: 699, retailMRP: 1299, colors: [{ name: 'Red Check', hex: '#B91C1C' }, { name: 'Blue Check', hex: '#1D4ED8' }], tags: ['checks', 'regular', 'casual'] },
  { name: 'Printed Hawaiian Shirt', cat: 'Shirt', fabric: 'Rayon', retailPrice: 849, retailMRP: 1499, colors: [{ name: 'Tropical', hex: '#059669' }, { name: 'Navy', hex: '#000080' }], tags: ['hawaiian', 'beach', 'vacation'] },

  // ======= T-SHIRT (6 products) =======
  { name: 'Graphic Print Round Neck Tee', cat: 'T-Shirt', fabric: 'Cotton', retailPrice: 499, retailMRP: 899, colors: [{ name: 'Black', hex: '#000000' }, { name: 'White', hex: '#FFFFFF' }], tags: ['graphic', 'round neck', 'casual'] },
  { name: 'Polo Collar T-Shirt', cat: 'T-Shirt', fabric: 'Cotton', retailPrice: 699, retailMRP: 1199, colors: [{ name: 'Navy', hex: '#000080' }, { name: 'Red', hex: '#DC2626' }], tags: ['polo', 'collar', 'smart casual'] },
  { name: 'Oversized Drop Shoulder Tee', cat: 'T-Shirt', fabric: 'Cotton', retailPrice: 599, retailMRP: 999, colors: [{ name: 'Sage', hex: '#BCB88A' }, { name: 'Lavender', hex: '#E6E6FA' }], tags: ['oversized', 'trendy', 'streetwear'] },
  { name: 'V-Neck Solid T-Shirt', cat: 'T-Shirt', fabric: 'Cotton', retailPrice: 399, retailMRP: 699, colors: [{ name: 'Charcoal', hex: '#36454F' }, { name: 'Olive', hex: '#6B8E23' }], tags: ['v-neck', 'solid', 'basic'] },
  { name: 'Striped Henley T-Shirt', cat: 'T-Shirt', fabric: 'Cotton', retailPrice: 549, retailMRP: 999, colors: [{ name: 'Grey Stripe', hex: '#9CA3AF' }, { name: 'Blue Stripe', hex: '#60A5FA' }], tags: ['henley', 'striped', 'casual'] },
  { name: 'Acid Wash Vintage Tee', cat: 'T-Shirt', fabric: 'Cotton', retailPrice: 649, retailMRP: 1099, colors: [{ name: 'Washed Black', hex: '#374151' }, { name: 'Washed Blue', hex: '#6B7280' }], tags: ['acid wash', 'vintage', 'retro'] },

  // ======= JEANS & TROUSERS (5 products) =======
  { name: 'Slim Fit Denim Jeans', cat: 'Jeans & Trousers', fabric: 'Denim', retailPrice: 1299, retailMRP: 2199, sizes: ['28', '30', '32', '34', '36'], colors: [{ name: 'Dark Blue', hex: '#1E3A5F' }, { name: 'Black', hex: '#000000' }], tags: ['slim fit', 'denim', 'stretch'] },
  { name: 'Relaxed Fit Cargo Trousers', cat: 'Jeans & Trousers', fabric: 'Cotton', retailPrice: 999, retailMRP: 1799, sizes: ['30', '32', '34', '36'], colors: [{ name: 'Khaki', hex: '#C3B091' }, { name: 'Olive', hex: '#6B8E23' }], tags: ['cargo', 'relaxed', 'utility'] },
  { name: 'Chino Slim Trousers', cat: 'Jeans & Trousers', fabric: 'Cotton', retailPrice: 899, retailMRP: 1599, sizes: ['28', '30', '32', '34', '36'], colors: [{ name: 'Beige', hex: '#F5F5DC' }, { name: 'Navy', hex: '#000080' }], tags: ['chino', 'office', 'smart'] },
  { name: 'Ripped Skinny Jeans', cat: 'Jeans & Trousers', fabric: 'Denim', retailPrice: 1499, retailMRP: 2499, sizes: ['28', '30', '32', '34'], colors: [{ name: 'Ice Blue', hex: '#A5C8D0' }, { name: 'Grey', hex: '#9CA3AF' }], tags: ['ripped', 'skinny', 'trendy'] },
  { name: 'Jogger Pants with Zip', cat: 'Jeans & Trousers', fabric: 'Polyester', retailPrice: 799, retailMRP: 1399, sizes: ['S', 'M', 'L', 'XL', 'XXL'], colors: [{ name: 'Black', hex: '#000000' }, { name: 'Grey', hex: '#6B7280' }], tags: ['jogger', 'athleisure', 'comfort'] },

  // ======= LEHENGA (4 products) =======
  { name: 'Bridal Embroidered Lehenga Choli', cat: 'Lehenga', fabric: 'Silk', retailPrice: 4999, retailMRP: 9999, sizes: ['Free Size'], colors: [{ name: 'Red', hex: '#DC2626' }], tags: ['bridal', 'wedding', 'heavy'] },
  { name: 'Georgette Festive Lehenga', cat: 'Lehenga', fabric: 'Georgette', retailPrice: 2999, retailMRP: 5999, sizes: ['Free Size'], colors: [{ name: 'Pink', hex: '#EC4899' }, { name: 'Peach', hex: '#FFDAB9' }], tags: ['festive', 'sangeet', 'light'] },
  { name: 'Net Designer Lehenga', cat: 'Lehenga', fabric: 'Net', retailPrice: 3499, retailMRP: 6999, sizes: ['Free Size'], colors: [{ name: 'Teal', hex: '#0D9488' }, { name: 'Gold', hex: '#D4AF37' }], tags: ['designer', 'reception', 'premium'] },
  { name: 'Velvet Winter Lehenga', cat: 'Lehenga', fabric: 'Velvet', retailPrice: 3999, retailMRP: 7999, sizes: ['Free Size'], colors: [{ name: 'Emerald', hex: '#065F46' }, { name: 'Burgundy', hex: '#800020' }], tags: ['velvet', 'winter', 'royal'] },

  // ======= SUIT SET (4 products) =======
  { name: 'Cotton Printed Suit Set', cat: 'Suit Set', fabric: 'Cotton', retailPrice: 1299, retailMRP: 2299, colors: [{ name: 'Blue', hex: '#2563EB' }, { name: 'Green', hex: '#16A34A' }], tags: ['printed', 'daily', 'cotton'] },
  { name: 'Rayon Embroidered Salwar Suit', cat: 'Suit Set', fabric: 'Rayon', retailPrice: 1599, retailMRP: 2799, colors: [{ name: 'Maroon', hex: '#800000' }, { name: 'Grey', hex: '#6B7280' }], tags: ['embroidered', 'ethnic', 'party'] },
  { name: 'Silk Festive Suit Set', cat: 'Suit Set', fabric: 'Silk', retailPrice: 2499, retailMRP: 4499, colors: [{ name: 'Orange', hex: '#EA580C' }, { name: 'Purple', hex: '#7C3AED' }], tags: ['festive', 'silk', 'premium'] },
  { name: 'Lawn Cotton Summer Suit', cat: 'Suit Set', fabric: 'Cotton', retailPrice: 999, retailMRP: 1799, colors: [{ name: 'White', hex: '#FFFFFF' }, { name: 'Pastel Blue', hex: '#BFDBFE' }], tags: ['summer', 'lawn', 'light'] },

  // ======= DRESS (4 products) =======
  { name: 'Bodycon Party Dress', cat: 'Dress', fabric: 'Polyester', retailPrice: 1299, retailMRP: 2299, colors: [{ name: 'Black', hex: '#000000' }, { name: 'Red', hex: '#DC2626' }], tags: ['bodycon', 'party', 'western'] },
  { name: 'Floral Maxi Dress', cat: 'Dress', fabric: 'Georgette', retailPrice: 1499, retailMRP: 2699, colors: [{ name: 'Floral Pink', hex: '#F472B6' }, { name: 'Yellow', hex: '#EAB308' }], tags: ['maxi', 'floral', 'summer'] },
  { name: 'A-Line Midi Dress', cat: 'Dress', fabric: 'Crepe', retailPrice: 999, retailMRP: 1799, colors: [{ name: 'Navy', hex: '#000080' }, { name: 'Emerald', hex: '#065F46' }], tags: ['midi', 'a-line', 'office'] },
  { name: 'Shirt Dress Belted', cat: 'Dress', fabric: 'Cotton', retailPrice: 1199, retailMRP: 2099, colors: [{ name: 'Olive', hex: '#6B8E23' }, { name: 'Tan', hex: '#D2B48C' }], tags: ['shirt dress', 'belted', 'casual'] },

  // ======= KIDS WEAR (3 products) =======
  { name: 'Kids Printed Kurta Pajama Set', cat: 'Kids Wear', fabric: 'Cotton', retailPrice: 599, retailMRP: 1099, sizes: ['2-3Y', '4-5Y', '6-7Y', '8-9Y'], colors: [{ name: 'Blue', hex: '#3B82F6' }, { name: 'Yellow', hex: '#EAB308' }], tags: ['kurta', 'festive', 'boys'] },
  { name: 'Girls Party Frock', cat: 'Kids Wear', fabric: 'Net', retailPrice: 799, retailMRP: 1499, sizes: ['2-3Y', '4-5Y', '6-7Y', '8-9Y'], colors: [{ name: 'Pink', hex: '#EC4899' }, { name: 'White', hex: '#FFFFFF' }], tags: ['frock', 'party', 'girls'] },
  { name: 'Kids Casual T-Shirt & Shorts Set', cat: 'Kids Wear', fabric: 'Cotton', retailPrice: 499, retailMRP: 899, sizes: ['2-3Y', '4-5Y', '6-7Y', '8-9Y'], colors: [{ name: 'Red', hex: '#DC2626' }, { name: 'Blue', hex: '#2563EB' }], tags: ['casual', 'combo', 'summer'] },

  // ======= DUPATTA & STOLE (3 products) =======
  { name: 'Banarasi Silk Dupatta', cat: 'Dupatta & Stole', fabric: 'Silk', retailPrice: 699, retailMRP: 1299, sizes: ['Free Size'], colors: [{ name: 'Red', hex: '#DC2626' }, { name: 'Gold', hex: '#D4AF37' }], tags: ['banarasi', 'silk', 'ethnic'] },
  { name: 'Pashmina Woolen Stole', cat: 'Dupatta & Stole', fabric: 'Wool', retailPrice: 899, retailMRP: 1699, sizes: ['Free Size'], colors: [{ name: 'Camel', hex: '#C19A6B' }, { name: 'Grey', hex: '#9CA3AF' }], tags: ['pashmina', 'winter', 'warm'] },
  { name: 'Chiffon Printed Dupatta', cat: 'Dupatta & Stole', fabric: 'Chiffon', retailPrice: 399, retailMRP: 699, sizes: ['Free Size'], colors: [{ name: 'Multi', hex: '#A855F7' }, { name: 'Peach', hex: '#FFDAB9' }], tags: ['chiffon', 'printed', 'daily'] },
];

// Wholesale tier generator based on retail price
function generateTiers(retailPrice) {
  const base = Math.round(retailPrice * 0.55);
  return [
    { minQty: 10, maxQty: 49, pricePerPiece: base + Math.round(retailPrice * 0.1) },
    { minQty: 50, maxQty: 99, pricePerPiece: base + Math.round(retailPrice * 0.05) },
    { minQty: 100, maxQty: null, pricePerPiece: base },
  ];
}

// Stock generator
function generateStock(sizes) {
  const stock = {};
  sizes.forEach((s) => {
    stock[s] = Math.floor(Math.random() * 40) + 10; // 10-50 units
  });
  return stock;
}

async function seedProducts() {
  await connectDB();
  console.log('\n🛍️  Seeding 50 Products...\n');

  // Get category map
  const categories = await Category.find().lean();
  const catMap = {};
  categories.forEach((c) => { catMap[c.name] = c._id; });

  let created = 0;
  let skipped = 0;
  let counter = await Product.countDocuments();

  for (let i = 0; i < PRODUCTS.length; i++) {
    const p = PRODUCTS[i];
    const catId = catMap[p.cat];
    if (!catId) {
      console.log(`  ⚠️  Category "${p.cat}" not found, skipping: ${p.name}`);
      skipped++;
      continue;
    }

    // Check duplicate by name
    const exists = await Product.findOne({ name: p.name });
    if (exists) {
      console.log(`  ⏭️  Already exists: ${p.name}`);
      skipped++;
      continue;
    }

    counter++;
    const sku = `FF-${String(counter).padStart(5, '0')}`;
    const sizes = p.sizes || ['S', 'M', 'L', 'XL', 'XXL'];
    const catImages = IMAGES[p.cat] || IMAGES['Kurti'];
    const imgIndex = i % catImages.length;

    const product = {
      sku,
      name: p.name,
      description: `Premium quality ${p.fabric.toLowerCase()} ${p.name.toLowerCase()}. Perfect for ${p.tags.slice(0, 2).join(' and ')} occasions. Available in multiple sizes and colors. Shop now at Fashion Forward for the best deals!`,
      category: catId,
      images: [catImages[imgIndex]],
      sizes,
      colors: p.colors,
      fabric: p.fabric,
      retailPrice: p.retailPrice,
      retailMRP: p.retailMRP,
      wholesaleTiers: generateTiers(p.retailPrice),
      wholesaleMOQ: 10,
      stock: generateStock(sizes),
      visibility: { retail: true, wholesale: true },
      active: true,
      featured: i < 8, // First 8 = featured
      tags: p.tags,
      weightGrams: 300 + Math.floor(Math.random() * 300),
    };

    await Product.create(product);
    console.log(`  ✅ ${sku} — ${p.name} (${p.cat}) — ₹${p.retailPrice}`);
    created++;
  }

  console.log(`\n📊 Results: ${created} created, ${skipped} skipped`);
  console.log('🎉 Product seeding complete!\n');
  process.exit(0);
}

seedProducts().catch((err) => { console.error(err); process.exit(1); });
