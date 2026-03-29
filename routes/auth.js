const express = require("express");
const router = express.Router();

// Login page
router.get("/login", (req, res) => {
  res.render("login", { error: null, user: req.session.user || null });
});

// Register page
router.get("/register", (req, res) => {
  res.render("register", { error: null, success: null, user: req.session.user || null });
});

// Register user
router.post("/register", (req, res) => {
  const db = req.app.locals.db;
  const { username, password } = req.body;

  if (!username || !password) {
    return res.render("register", {
      error: "All fields are required",
      success: null,
      user: req.session.user || null
    });
  }

  const query = `INSERT INTO users (username, password) VALUES (?, ?)`;

  db.run(query, [username, password], function (err) {
    if (err) {
      return res.render("register", {
        error: "Username already exists",
        success: null,
        user: req.session.user || null
      });
    }

    res.render("register", {
      error: null,
      success: "Registration successful. Please login.",
      user: req.session.user || null
    });
  });
});

// Login user
router.post("/login", (req, res) => {
  const db = req.app.locals.db;
  const { username, password } = req.body;

  const query = `SELECT * FROM users WHERE username = ? AND password = ?`;

  db.get(query, [username, password], (err, user) => {
    if (err) {
      return res.render("login", {
        error: "Database error",
        user: req.session.user || null
      });
    }

    if (!user) {
      return res.render("login", {
        error: "Invalid username or password",
        user: req.session.user || null
      });
    }

    req.session.user = {
      id: user.id,
      username: user.username
    };

    res.redirect("/products");
  });
});

// Logout
router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

module.exports = router;