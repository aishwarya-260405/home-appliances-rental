const express = require("express");
const router = express.Router();


// ======================================================
// PRODUCTS LIST
// ======================================================

router.get("/products", (req, res) => {

  const db = req.app.locals.db;

  db.all(
    "SELECT * FROM products ORDER BY id ASC",
    [],

    (err, rows) => {

      if (err) {

        console.error(
          "DB error:",
          err.message
        );

        return res.send(
          "Error fetching products"
        );

      }


      console.log(
        "Products count from app:",
        rows.length
      );

      console.log(
        "Products from app:",
        rows
      );


      res.render(
        "products",
        {

          products: rows,

          user:
            req.session.user || null

        }
      );

    }
  );

});


// ======================================================
// PRODUCT DETAILS
// ======================================================

router.get(
  "/products/:productId",
  (req, res) => {

    const db =
      req.app.locals.db;

    const productId =
      req.params.productId;


    // ==================================================
    // GET PRODUCT
    // ==================================================

    db.get(
      "SELECT * FROM products WHERE id = ?",
      [productId],

      (err, product) => {

        if (err) {

          console.error(
            "Product details error:",
            err.message
          );

          return res.send(
            "Error fetching product details"
          );

        }


        // ==============================================
        // PRODUCT NOT FOUND
        // ==============================================

        if (!product) {

          return res.status(404).send(
            "Product not found"
          );

        }


        // ==============================================
        // RENDER PRODUCT DETAILS
        // ==============================================

        res.render(
          "product-details",
          {

            product: product,

            user:
              req.session.user || null

          }
        );

      }
    );

  }
);


module.exports = router;