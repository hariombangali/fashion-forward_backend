require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');

const seedData = async () => {
  await connectDB();
  console.log('🌱 Seeding database...\n');

  // ---- ADMIN USER ----
  const existingAdmin = await User.findOne({ role: 'admin' });
  if (!existingAdmin) {
    const admin = await User.create({
      name: 'Admin',
      email: 'admin@fashionforward.in',
      phone: '+919876543210',
      password: 'admin123',
      role: 'admin',
      status: 'active',
    });
    console.log(`✅ Admin created: ${admin.email} / admin123`);
  } else {
    console.log(`⏭️  Admin already exists: ${existingAdmin.email}`);
  }

  // ---- CATEGORIES ----
  const categories = [
    { name: 'Kurti', description: 'Designer & printed kurtis for women', sortOrder: 1 },
    { name: 'Saree', description: 'Traditional & designer sarees', sortOrder: 2 },
    { name: 'Suit Set', description: 'Salwar suit sets & dress materials', sortOrder: 3 },
    { name: 'Lehenga', description: 'Bridal & party lehengas', sortOrder: 4 },
    { name: 'Shirt', description: "Men's casual & formal shirts", sortOrder: 5 },
    { name: 'T-Shirt', description: 'Casual & graphic t-shirts', sortOrder: 6 },
    { name: 'Jeans & Trousers', description: "Men's & women's bottoms", sortOrder: 7 },
    { name: 'Dress', description: 'Western dresses & gowns', sortOrder: 8 },
    { name: 'Kids Wear', description: 'Clothing for kids', sortOrder: 9 },
    { name: 'Dupatta & Stole', description: 'Dupattas, stoles, and scarves', sortOrder: 10 },
  ];

  for (const cat of categories) {
    const exists = await Category.findOne({ name: cat.name });
    if (!exists) {
      await Category.create(cat);
      console.log(`✅ Category: ${cat.name}`);
    } else {
      console.log(`⏭️  Category exists: ${cat.name}`);
    }
  }

  // ---- SAMPLE PRODUCTS ----
  const productsCount = await Product.countDocuments();
  if (productsCount === 0) {
    const kurtiCat = await Category.findOne({ name: 'Kurti' });
    const sareeCat = await Category.findOne({ name: 'Saree' });
    const shirtCat = await Category.findOne({ name: 'Shirt' });

    const sampleProducts = [
      {
        sku: 'KURTI-FLORAL-001',
        name: 'Cotton Floral Printed Kurti',
        description: 'Beautiful cotton floral printed kurti perfect for everyday wear. Soft fabric with vibrant prints. Ideal for casual and semi-formal occasions.',
        category: kurtiCat._id,
        images: ['https://via.placeholder.com/800x800?text=Kurti+Floral+1'],
        sizes: ['S', 'M', 'L', 'XL', 'XXL'],
        colors: [{ name: 'Red', hex: '#DC2626' }, { name: 'Blue', hex: '#2563EB' }],
        fabric: 'Cotton',
        retailPrice: 799,
        retailMRP: 1299,
        wholesaleTiers: [
          { minQty: 10, maxQty: 49, pricePerPiece: 450 },
          { minQty: 50, maxQty: 99, pricePerPiece: 400 },
          { minQty: 100, maxQty: null, pricePerPiece: 350 },
        ],
        wholesaleMOQ: 10,
        stock: { S: 25, M: 40, L: 50, XL: 30, XXL: 15 },
        visibility: { retail: true, wholesale: true },
        featured: true,
        tags: ['kurti', 'cotton', 'floral', 'printed', 'casual'],
      },
      {
        sku: 'KURTI-EMBRD-002',
        name: 'Rayon Embroidered A-Line Kurti',
        description: 'Elegant rayon A-line kurti with beautiful thread embroidery work. Perfect for office wear and casual outings.',
        category: kurtiCat._id,
        images: ['https://via.placeholder.com/800x800?text=Kurti+Embroidered+2'],
        sizes: ['S', 'M', 'L', 'XL'],
        colors: [{ name: 'Maroon', hex: '#800000' }, { name: 'Navy', hex: '#000080' }],
        fabric: 'Rayon',
        retailPrice: 999,
        retailMRP: 1599,
        wholesaleTiers: [
          { minQty: 10, maxQty: 49, pricePerPiece: 580 },
          { minQty: 50, maxQty: 99, pricePerPiece: 520 },
          { minQty: 100, maxQty: null, pricePerPiece: 470 },
        ],
        wholesaleMOQ: 10,
        stock: { S: 20, M: 35, L: 40, XL: 20 },
        visibility: { retail: true, wholesale: true },
        featured: true,
        tags: ['kurti', 'rayon', 'embroidered', 'a-line', 'office'],
      },
      {
        sku: 'SAREE-SILK-001',
        name: 'Banarasi Silk Saree with Blouse',
        description: 'Stunning Banarasi silk saree with rich zari work. Comes with unstitched blouse piece. Perfect for weddings and festivals.',
        category: sareeCat._id,
        images: ['https://via.placeholder.com/800x800?text=Saree+Silk+1'],
        sizes: ['Free Size'],
        colors: [{ name: 'Red', hex: '#DC2626' }, { name: 'Green', hex: '#059669' }],
        fabric: 'Silk',
        retailPrice: 2499,
        retailMRP: 4999,
        wholesaleTiers: [
          { minQty: 5, maxQty: 24, pricePerPiece: 1500 },
          { minQty: 25, maxQty: 49, pricePerPiece: 1350 },
          { minQty: 50, maxQty: null, pricePerPiece: 1200 },
        ],
        wholesaleMOQ: 5,
        stock: { 'Free Size': 100 },
        visibility: { retail: true, wholesale: true },
        featured: true,
        tags: ['saree', 'silk', 'banarasi', 'wedding', 'festival'],
      },
      {
        sku: 'SHIRT-CTN-001',
        name: 'Men Cotton Casual Shirt',
        description: 'Premium cotton casual shirt for men. Comfortable fit with modern design. Suitable for daily wear and casual occasions.',
        category: shirtCat._id,
        images: ['https://via.placeholder.com/800x800?text=Shirt+Cotton+1'],
        sizes: ['S', 'M', 'L', 'XL', 'XXL'],
        colors: [{ name: 'White', hex: '#FFFFFF' }, { name: 'Sky Blue', hex: '#87CEEB' }],
        fabric: 'Cotton',
        retailPrice: 699,
        retailMRP: 1199,
        wholesaleTiers: [
          { minQty: 12, maxQty: 49, pricePerPiece: 380 },
          { minQty: 50, maxQty: 99, pricePerPiece: 340 },
          { minQty: 100, maxQty: null, pricePerPiece: 300 },
        ],
        wholesaleMOQ: 12,
        stock: { S: 30, M: 50, L: 60, XL: 40, XXL: 20 },
        visibility: { retail: true, wholesale: true },
        featured: true,
        tags: ['shirt', 'men', 'cotton', 'casual'],
      },
      {
        sku: 'KURTI-GEOR-003',
        name: 'Georgette Party Wear Kurti',
        description: 'Stunning georgette party wear kurti with sequin work. Perfect for parties and festive occasions. Lightweight and comfortable.',
        category: kurtiCat._id,
        images: ['https://via.placeholder.com/800x800?text=Kurti+Georgette+3'],
        sizes: ['S', 'M', 'L', 'XL'],
        colors: [{ name: 'Black', hex: '#000000' }, { name: 'Pink', hex: '#EC4899' }],
        fabric: 'Georgette',
        retailPrice: 1299,
        retailMRP: 2199,
        wholesaleTiers: [
          { minQty: 10, maxQty: 49, pricePerPiece: 750 },
          { minQty: 50, maxQty: 99, pricePerPiece: 680 },
          { minQty: 100, maxQty: null, pricePerPiece: 620 },
        ],
        wholesaleMOQ: 10,
        stock: { S: 15, M: 25, L: 30, XL: 15 },
        visibility: { retail: true, wholesale: true },
        featured: false,
        tags: ['kurti', 'georgette', 'party', 'sequin', 'festive'],
      },
    ];

    for (const pData of sampleProducts) {
      await Product.create(pData);
      console.log(`✅ Product: ${pData.name}`);
    }
  } else {
    console.log(`⏭️  Products already exist (${productsCount} found)`);
  }

  // ---- SAMPLE CUSTOMER ----
  const existingCustomer = await User.findOne({ email: 'customer@test.com' });
  if (!existingCustomer) {
    await User.create({
      name: 'Test Customer',
      email: 'customer@test.com',
      phone: '+919999999999',
      password: 'test1234',
      role: 'customer',
      status: 'active',
      addresses: [{
        label: 'Home',
        fullName: 'Test Customer',
        phone: '+919999999999',
        line1: '123 MG Road',
        city: 'Indore',
        state: 'Madhya Pradesh',
        pincode: '452001',
        isDefault: true,
      }],
    });
    console.log('✅ Test customer: customer@test.com / test1234');
  }

  console.log('\n✅ Seeding complete!\n');
  process.exit(0);
};

seedData().catch(err => { console.error(err); process.exit(1); });
