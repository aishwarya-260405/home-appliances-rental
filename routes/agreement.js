const express = require("express");
const router = express.Router();


// ======================================================
// SHOW RENTAL AGREEMENT
// ======================================================

router.post("/agreement", (req, res) => {

  if (!req.session.user) {
    return res.redirect("/login");
  }


  const db = req.app.locals.db;

  const productId =
    req.body.product_id;

  const rentalMonths =
    parseInt(
      req.body.rental_months,
      10
    );

  const rentalStartDate =
    req.body.rental_start_date;


  // ==================================================
  // VALIDATE PRODUCT
  // ==================================================

  if (!productId) {

    return res.send(
      "Product is required"
    );

  }


  // ==================================================
  // VALIDATE RENTAL DURATION
  // ==================================================

  if (
    !Number.isInteger(rentalMonths) ||
    rentalMonths < 1 ||
    rentalMonths > 12
  ) {

    return res.send(
      "Invalid rental duration"
    );

  }


  // ==================================================
  // VALIDATE START DATE
  // ==================================================

  if (
    !rentalStartDate ||
    !/^\d{4}-\d{2}-\d{2}$/.test(
      rentalStartDate
    )
  ) {

    return res.send(
      "Invalid rental start date"
    );

  }


  // ==================================================
  // PARSE START DATE
  // ==================================================

  const dateParts =
    rentalStartDate.split("-");

  const startDate =
    new Date(
      Number(dateParts[0]),
      Number(dateParts[1]) - 1,
      Number(dateParts[2])
    );


  if (
    isNaN(
      startDate.getTime()
    )
  ) {

    return res.send(
      "Invalid rental start date"
    );

  }


  // ==================================================
  // PREVENT PAST DATE
  // ==================================================

  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );


  if (startDate < today) {

    return res.send(
      "Rental start date cannot be in the past"
    );

  }


  // ==================================================
  // CALCULATE END DATE
  // ==================================================

  const endDate =
    new Date(startDate);

  endDate.setMonth(
    endDate.getMonth() +
    rentalMonths
  );


  // ==================================================
  // FORMAT DISPLAY DATE
  // ==================================================

  function formatDisplayDate(date) {

    return date.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }
    );

  }


  const rentalEndDate =
    formatDisplayDate(
      endDate
    );


  const rentalStartDateDisplay =
    formatDisplayDate(
      startDate
    );


  // ==================================================
  // GET PRODUCT
  // ==================================================

  db.get(
    "SELECT * FROM products WHERE id = ?",
    [productId],

    (err, product) => {

      if (err) {

        console.error(
          "Agreement product error:",
          err
        );

        return res.send(
          "Error loading agreement"
        );

      }


      if (!product) {

        return res.status(404).send(
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
      // RENDER AGREEMENT
      // ==================================================

      res.render(
        "agreement",
        {

          product:
            product,

          user:
            req.session.user,

          rentalStartDate:
            rentalStartDateDisplay,

          rentalStartDateRaw:
            rentalStartDate,

          rentalMonths:
            rentalMonths,

          rentalEndDate:
            rentalEndDate,

          totalAmount:
            totalAmount

        }
      );

    }
  );

});


module.exports = router;