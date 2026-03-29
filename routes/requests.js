const express = require("express");
const router = express.Router();

// Add request
router.post("/requests/add", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const db = req.app.locals.db;
  const userId = req.session.user.id;
  const productId = req.body.product_id;

  db.run(
    "INSERT INTO requests (user_id, product_id) VALUES (?, ?)",
    [userId, productId],
    (err) => {
      if (err) {
        console.error(err);
        return res.send("Error adding request");
      }
      res.redirect("/requests");
    }
  );
});

// View requests
router.get("/requests", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const db = req.app.locals.db;
  const userId = req.session.user.id;

  db.all(
    `SELECT r.id, p.name, p.category, p.price, r.status, r.request_date
     FROM requests r
     JOIN products p ON r.product_id = p.id
     WHERE r.user_id = ?`,
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

// Delete request
router.post("/requests/delete", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }

  const db = req.app.locals.db;
  const requestId = req.body.id;

  db.run("DELETE FROM requests WHERE id = ?", [requestId], (err) => {
    if (err) {
      console.error(err);
      return res.send("Error deleting request");
    }
    res.redirect("/requests");
  });
});

module.exports = router;