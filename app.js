const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = 3000;

// Database connection
const dbPath = path.join(__dirname, "database", "db.sqlite");
console.log("Using DB file:", dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Database connection error:", err.message);
  } else {
    console.log("Connected to SQLite database");
  }
});

// Create tables and ensure products exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price INTEGER NOT NULL,
      image TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      product_id INTEGER,
      status TEXT DEFAULT 'Pending',
      request_date TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.get("SELECT COUNT(*) AS count FROM products", (err, row) => {
    if (err) {
      console.error("Count error:", err.message);
      return;
    }

    console.log("Current product count:", row.count);

    db.run(
      `INSERT INTO products (name, category, price, image)
       SELECT 'Air Conditioner', 'AC', 1500, '/images/ac.jpg'
       WHERE NOT EXISTS (
         SELECT 1 FROM products WHERE name = 'Air Conditioner'
       )`
    );

    db.run(
      `INSERT INTO products (name, category, price, image)
       SELECT 'Refrigerator', 'Fridge', 1200, '/images/fridge.jpg'
       WHERE NOT EXISTS (
         SELECT 1 FROM products WHERE name = 'Refrigerator'
       )`
    );

    db.run(
      `INSERT INTO products (name, category, price, image)
       SELECT 'Television', 'TV', 1000, '/images/tv.jpg'
       WHERE NOT EXISTS (
         SELECT 1 FROM products WHERE name = 'Television'
       )`
    );

    db.run(
      `INSERT INTO products (name, category, price, image)
       SELECT 'Microwave Oven', 'Kitchen', 800, '/images/microwave.jpg'
       WHERE NOT EXISTS (
         SELECT 1 FROM products WHERE name = 'Microwave Oven'
       )`
    );

    db.run(
      `INSERT INTO products (name, category, price, image)
       SELECT 'Washing Machine', 'Laundry', 1300, '/images/washing-machine.jpg'
       WHERE NOT EXISTS (
         SELECT 1 FROM products WHERE name = 'Washing Machine'
       )`,
      (insertErr) => {
        if (insertErr) {
          console.error("Insert error:", insertErr.message);
        } else {
          console.log("Missing products checked/inserted");
        }
      }
    );
  });

  console.log("Tables ready");
});

app.locals.db = db;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: "secret-key",
    resave: false,
    saveUninitialized: false
  })
);

app.use(express.static(path.join(__dirname, "public")));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Routes
const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const requestRoutes = require("./routes/requests");

app.use("/", authRoutes);
app.use("/", productRoutes);
app.use("/", requestRoutes);

// Home
app.get("/", (req, res) => {
  res.render("index", {
    user: req.session.user || null
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});