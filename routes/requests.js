const express = require("express");
const router = express.Router();

console.log("🔥 REQUEST ROUTES LOADED");

// ======================================================
// RENTAL DETAILS PAGE
// ======================================================

router.get("/rent/:productId", (req, res) => {
  console.log("🔥 RENT ROUTE HIT:", req.params.productId);

  if (!req.session.user) {
    return res.redirect("/login");
  }

  const db = req.app.locals.db;
  const productId = req.params.productId;

  db.get(
    "SELECT * FROM products WHERE id = ?",
    [productId],
    (err, product) => {
      if (err) {
        console.error("Product fetch error:", err);
        return res.send("Error fetching product");
      }

      if (!product) {
        return res.send("Product not found");
      }

      console.log("🔥 PRODUCT FOUND:", product.name);

      res.render("rent", {
        product: product,
        user: req.session.user
      });
    }
  );
});


// ======================================================
// ADD RENTAL REQUEST
// ======================================================

router.post("/requests/add", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const db = req.app.locals.db;

  const userId = req.session.user.id;
  const productId = req.body.product_id;
  const rentalMonths = parseInt(req.body.rental_months, 10);

  if (
    !Number.isInteger(rentalMonths) ||
    rentalMonths < 1 ||
    rentalMonths > 12
  ) {
    return res.send("Invalid rental duration");
  }

  db.get(
    "SELECT price FROM products WHERE id = ?",
    [productId],
    (err, product) => {
      if (err) {
        console.error(err);
        return res.send("Error fetching product");
      }

      if (!product) {
        return res.send("Product not found");
      }

      const totalAmount = product.price * rentalMonths;

      db.run(
        `INSERT INTO requests
        (user_id, product_id, rental_months, total_amount)
        VALUES (?, ?, ?, ?)`,
        [
          userId,
          productId,
          rentalMonths,
          totalAmount
        ],
        (err) => {
          if (err) {
            console.error("Request insert error:", err);
            return res.send("Error adding rental request");
          }

          res.redirect("/requests");
        }
      );
    }
  );
});


// ======================================================
// VIEW MY REQUESTS
// ======================================================

router.get("/requests", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const db = req.app.locals.db;
  const userId = req.session.user.id;

  db.all(
    `SELECT
      r.id,
      p.name,
      p.category,
      p.price,
      r.rental_months,
      r.total_amount,
      r.status,
      r.request_date
     FROM requests r
     JOIN products p ON r.product_id = p.id
     WHERE r.user_id = ?
     ORDER BY r.id DESC`,
    [userId],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.send("Error fetching requests");
      }

      res.render("requests", {
        requests: rows,
        user: req.session.user
      });
    }
  );
});


// ======================================================
// DELETE REQUEST
// ======================================================

router.post("/requests/delete", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const db = req.app.locals.db;

  const requestId = req.body.id;
  const userId = req.session.user.id;

  db.run(
    "DELETE FROM requests WHERE id = ? AND user_id = ?",
    [requestId, userId],
    (err) => {
      if (err) {
        console.error(err);
        return res.send("Error deleting request");
      }

      res.redirect("/requests");
    }
  );
});


module.exports = router;