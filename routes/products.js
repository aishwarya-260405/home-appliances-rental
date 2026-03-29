const express = require("express");
const router = express.Router();

router.get("/products", (req, res) => {
  const db = req.app.locals.db;

  db.all("SELECT * FROM products ORDER BY id ASC", [], (err, rows) => {
    if (err) {
      console.error("DB error:", err.message);
      return res.send("Error fetching products");
    }

    console.log("Products count from app:", rows.length);
    console.log("Products from app:", rows);

    res.render("products", {
      products: rows,
      user: req.session.user || null
    });
  });
});

module.exports = router;