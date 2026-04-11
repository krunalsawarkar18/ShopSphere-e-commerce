require("dotenv").config();

const { connectDatabase } = require("./config/db");
const Product = require("./models/Product");
const products = require("./data/products");

async function seedDatabase() {
  try {
    await connectDatabase();
    await Product.deleteMany();
    await Product.insertMany(products);
    console.log(`Seeded ${products.length} products.`);
    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error.message);
    process.exit(1);
  }
}

seedDatabase();
