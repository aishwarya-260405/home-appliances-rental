require("dotenv").config();

const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const sqlite3 = require("sqlite3").verbose();
const Razorpay = require("razorpay");

const app = express();
const PORT = 3000;

// ======================================================
// RAZORPAY CONFIGURATION
// ======================================================

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

app.locals.razorpay = razorpay;
app.locals.razorpayKeyId = process.env.RAZORPAY_KEY_ID;


// ======================================================
// DATABASE CONNECTION
// ======================================================

const dbPath = path.join(__dirname, "database", "db.sqlite");

console.log("Using DB file:", dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Database connection error:", err.message);
  } else {
    console.log("Connected to SQLite database");
  }
});


// ======================================================
// CREATE TABLES
// ======================================================

db.serialize(() => {

  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )
  `);


  // Products table
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price INTEGER NOT NULL,
      image TEXT
    )
  `);


  // Rental requests table
  db.run(`
    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      product_id INTEGER,
      status TEXT DEFAULT 'Pending',
      request_date TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

    // Add rental duration and total amount columns
  db.run(`
    ALTER TABLE requests
    ADD COLUMN rental_months INTEGER DEFAULT 1
  `, (err) => {
    if (err && !err.message.includes("duplicate column name")) {
      console.error("rental_months column error:", err.message);
    }
  });

  db.run(`
  ALTER TABLE requests
  ADD COLUMN rental_start_date TEXT
`, (err) => {
  if (err && !err.message.includes("duplicate column name")) {
    console.error(
      "rental_start_date column error:",
      err.message
    );
  }
});

db.run(`
  ALTER TABLE requests
  ADD COLUMN rental_end_date TEXT
`, (err) => {
  if (err && !err.message.includes("duplicate column name")) {
    console.error(
      "rental_end_date column error:",
      err.message
    );
  }
});

  db.run(`
    ALTER TABLE requests
    ADD COLUMN total_amount INTEGER DEFAULT 0
  `, (err) => {
    if (err && !err.message.includes("duplicate column name")) {
      console.error("total_amount column error:", err.message);
    }
  });

  
    // Payments table
  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER,
      user_id INTEGER,
      product_id INTEGER,
      amount INTEGER NOT NULL,
      currency TEXT DEFAULT 'INR',
      razorpay_order_id TEXT,
      razorpay_payment_id TEXT,
      razorpay_signature TEXT,
      status TEXT DEFAULT 'Created',
      payment_date TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ====================================================
  // ENSURE DEFAULT PRODUCTS EXIST
  // ====================================================

  db.get("SELECT COUNT(*) AS count FROM products", (err, row) => {

    if (err) {
      console.error("Count error:", err.message);
      return;
    }

    console.log("Current product count:", row.count);


    // Air Conditioner
    db.run(`
      INSERT INTO products (name, category, price, image)
      SELECT
        'Air Conditioner',
        'AC',
        1500,
        '/images/ac.jpg'
      WHERE NOT EXISTS (
        SELECT 1 FROM products
        WHERE name = 'Air Conditioner'
      )
    `);


    // Refrigerator
    db.run(`
      INSERT INTO products (name, category, price, image)
      SELECT
        'Refrigerator',
        'Fridge',
        1200,
        '/images/fridge.jpg'
      WHERE NOT EXISTS (
        SELECT 1 FROM products
        WHERE name = 'Refrigerator'
      )
    `);


    // Television
    db.run(`
      INSERT INTO products (name, category, price, image)
      SELECT
        'Television',
        'TV',
        1000,
        '/images/tv.jpg'
      WHERE NOT EXISTS (
        SELECT 1 FROM products
        WHERE name = 'Television'
      )
    `);


    // Microwave Oven
    db.run(`
      INSERT INTO products (name, category, price, image)
      SELECT
        'Microwave Oven',
        'Kitchen',
        800,
        '/images/microwave.jpg'
      WHERE NOT EXISTS (
        SELECT 1 FROM products
        WHERE name = 'Microwave Oven'
      )
    `);


    // Washing Machine
    db.run(`
      INSERT INTO products (name, category, price, image)
      SELECT
        'Washing Machine',
        'Laundry',
        1300,
        '/images/washing-machine.jpg'
      WHERE NOT EXISTS (
        SELECT 1 FROM products
        WHERE name = 'Washing Machine'
      )
    `, (insertErr) => {

      if (insertErr) {
        console.error("Insert error:", insertErr.message);
      } else {
        console.log("Missing products checked/inserted");
      }

    });

  });

  console.log("Tables ready");

});


// ======================================================
// MAKE DATABASE AVAILABLE TO ROUTES
// ======================================================

app.locals.db = db;


// ======================================================
// MIDDLEWARE
// ======================================================

app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.json());

app.use(
  session({
    secret: "secret-key",
    resave: false,
    saveUninitialized: false
  })
);


// ======================================================
// STATIC FILES
// ======================================================

app.use(express.static(path.join(__dirname, "public")));


// ======================================================
// EJS CONFIGURATION
// ======================================================

app.set("view engine", "ejs");

app.set("views", path.join(__dirname, "views"));


// ======================================================
// ROUTES
// ======================================================

const authRoutes = require("./routes/auth");

const productRoutes = require("./routes/products");

const requestRoutes = require("./routes/requests");

const paymentRoutes = require("./routes/payment");

app.use("/", authRoutes);

app.use("/", productRoutes);

app.use("/", requestRoutes);

app.use("/", paymentRoutes);

console.log("🔥 REQUEST ROUTES REGISTERED");


// ======================================================
// HOME PAGE
// ======================================================

app.get("/", (req, res) => {

  res.render("index", {
    user: req.session.user || null
  });

});


// ======================================================
// START SERVER
// ======================================================

app.listen(PORT, () => {

  console.log(
    `Server running at http://localhost:${PORT}`
  );

});