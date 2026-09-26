const express = require("express");
const router = express.Router();


// ======================================================
// RENTAL DETAILS PAGE
// ======================================================

router.get("/rent/:productId", (req, res) => {

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

        console.error(
          "Product fetch error:",
          err
        );

        return res.send(
          "Error fetching product"
        );
      }

      if (!product) {

        return res.send(
          "Product not found"
        );
      }

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

  const userId =
    req.session.user.id;

  const productId =
    req.body.product_id;

  const rentalMonths =
    parseInt(
      req.body.rental_months,
      10
    );


  // ====================================================
  // VALIDATE RENTAL DURATION
  // ====================================================

  if (
    !Number.isInteger(rentalMonths) ||
    rentalMonths < 1 ||
    rentalMonths > 12
  ) {

    return res.send(
      "Invalid rental duration"
    );

  }


  // ====================================================
  // GET PRODUCT PRICE
  // ====================================================

  db.get(
    "SELECT price FROM products WHERE id = ?",
    [productId],

    (err, product) => {

      if (err) {

        console.error(
          "Product fetch error:",
          err
        );

        return res.send(
          "Error fetching product"
        );

      }


      if (!product) {

        return res.send(
          "Product not found"
        );

      }


      // ==================================================
      // CALCULATE TOTAL
      // ==================================================

      const totalAmount =
        product.price *
        rentalMonths;


      // ==================================================
      // CREATE REQUEST
      // ==================================================

      db.run(
        `INSERT INTO requests
        (
          user_id,
          product_id,
          rental_months,
          total_amount
        )
        VALUES (?, ?, ?, ?)`,

        [
          userId,
          productId,
          rentalMonths,
          totalAmount
        ],

        function (err) {

          if (err) {

            console.error(
              "Rental request error:",
              err
            );

            return res.send(
              "Error adding rental request"
            );

          }

          res.redirect(
            "/requests"
          );

        }
      );

    }
  );

});


// ======================================================
// VIEW MY RENTAL REQUESTS
// ======================================================

router.get("/requests", (req, res) => {

  if (!req.session.user) {
    return res.redirect("/login");
  }

  const db = req.app.locals.db;

  const userId =
    req.session.user.id;


  db.all(

    `SELECT

      r.id,

      p.name,

      p.category,

      p.price,

      r.rental_months,

      r.total_amount,

      r.status,

      r.request_date,

      r.rental_start_date,

      r.rental_end_date

     FROM requests r

     JOIN products p
       ON r.product_id = p.id

     WHERE r.user_id = ?

     ORDER BY r.id DESC`,

    [userId],

    (err, rows) => {

      if (err) {

        console.error(
          "Error fetching requests:",
          err
        );

        return res.send(
          "Error fetching requests"
        );

      }


      console.log(
        "🔥 RENTAL REQUESTS LOADED:",
        rows.length
      );


      res.render(
        "requests",
        {

          requests: rows,

          user:
            req.session.user

        }
      );

    }
  );

});


// ======================================================
// DELETE RENTAL REQUEST
// ======================================================

router.post(
  "/requests/delete",
  (req, res) => {

    if (!req.session.user) {
      return res.redirect("/login");
    }

    const db =
      req.app.locals.db;

    const requestId =
      req.body.id;

    const userId =
      req.session.user.id;


    db.run(

      `DELETE FROM requests

       WHERE id = ?

       AND user_id = ?`,

      [
        requestId,
        userId
      ],

      (err) => {

        if (err) {

          console.error(
            "Delete request error:",
            err
          );

          return res.send(
            "Error deleting request"
          );

        }


        res.redirect(
          "/requests"
        );

      }
    );

  }
);


// ======================================================
// EXPORT ROUTER
// ======================================================

module.exports = router;