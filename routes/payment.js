const express = require("express");
const crypto = require("crypto");

const router = express.Router();


// ======================================================
// CREATE RAZORPAY ORDER
// ======================================================

router.post("/payment/create-order", (req, res) => {

  if (!req.session.user) {
    return res.redirect("/login");
  }

  const db = req.app.locals.db;
  const razorpay = req.app.locals.razorpay;

  const userId = req.session.user.id;
  const productId = req.body.product_id;
  const rentalMonths = parseInt(req.body.rental_months, 10);


  // ====================================================
  // VALIDATE RENTAL DURATION
  // ====================================================

  if (
    !Number.isInteger(rentalMonths) ||
    rentalMonths < 1 ||
    rentalMonths > 12
  ) {
    return res.send("Invalid rental duration");
  }


  // ====================================================
  // GET PRODUCT
  // ====================================================

  db.get(
    "SELECT * FROM products WHERE id = ?",
    [productId],
    async (err, product) => {

      if (err) {
        console.error("Product fetch error:", err);
        return res.send("Error fetching product");
      }

      if (!product) {
        return res.send("Product not found");
      }


      // ==================================================
      // CALCULATE TOTAL
      // ==================================================

      const totalAmount =
        product.price * rentalMonths;

      const amountInPaise =
        totalAmount * 100;


      try {

        // ==================================================
        // CREATE RAZORPAY ORDER
        // ==================================================

        const order =
          await razorpay.orders.create({

            amount: amountInPaise,

            currency: "INR",

            receipt:
              `rental_${userId}_${Date.now()}`

          });


        console.log(
          "🔥 RAZORPAY ORDER CREATED:",
          order.id
        );


        // ==================================================
        // CREATE RENTAL REQUEST
        // ==================================================

        db.run(
          `INSERT INTO requests
          (
            user_id,
            product_id,
            rental_months,
            total_amount,
            status
          )
          VALUES (?, ?, ?, ?, ?)`,
          [
            userId,
            productId,
            rentalMonths,
            totalAmount,
            "Payment Pending"
          ],
          function (requestErr) {

            if (requestErr) {

              console.error(
                "Rental request creation error:",
                requestErr
              );

              return res.send(
                "Error creating rental request"
              );
            }


            const requestId =
              this.lastID;


            console.log(
              "🔥 RENTAL REQUEST CREATED:",
              requestId
            );


            // ==================================================
            // SAVE PAYMENT RECORD
            // ==================================================

            db.run(
              `INSERT INTO payments
              (
                request_id,
                user_id,
                product_id,
                amount,
                currency,
                razorpay_order_id,
                status
              )
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                requestId,
                userId,
                productId,
                totalAmount,
                "INR",
                order.id,
                "Created"
              ],
              function (paymentErr) {

                if (paymentErr) {

                  console.error(
                    "Payment record error:",
                    paymentErr
                  );

                  return res.send(
                    "Error saving payment record"
                  );
                }


                console.log(
                  "🔥 PAYMENT RECORD CREATED:",
                  this.lastID
                );


                // ==================================================
                // SEND PAYMENT PAGE
                // ==================================================

                res.render("payment", {

                  user: req.session.user,

                  product: product,

                  rentalMonths:
                    rentalMonths,

                  totalAmount:
                    totalAmount,

                  razorpayOrderId:
                    order.id,

                  razorpayKeyId:
                    req.app.locals.razorpayKeyId

                });

              }
            );

          }
        );

      } catch (error) {

        console.error(
          "Razorpay order creation error:",
          error
        );

        return res.send(
          "Unable to create Razorpay order"
        );
      }

    }
  );

});


// ======================================================
// VERIFY RAZORPAY PAYMENT
// ======================================================

router.post("/payment/verify", (req, res) => {

  if (!req.session.user) {

    return res.status(401).json({

      success: false,

      message:
        "User not logged in"

    });

  }


  const db = req.app.locals.db;

  const userId =
    req.session.user.id;


  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature
  } = req.body;


  // ====================================================
  // VALIDATE RESPONSE
  // ====================================================

  if (
    !razorpay_order_id ||
    !razorpay_payment_id ||
    !razorpay_signature
  ) {

    return res.status(400).json({

      success: false,

      message:
        "Missing payment verification data"

    });

  }


  // ====================================================
  // FIND PAYMENT
  // ====================================================

  db.get(
    `SELECT *
     FROM payments
     WHERE razorpay_order_id = ?
     AND user_id = ?`,
    [
      razorpay_order_id,
      userId
    ],
    (err, paymentRecord) => {

      if (err) {

        console.error(
          "Payment lookup error:",
          err
        );

        return res.status(500).json({

          success: false,

          message:
            "Database error"

        });

      }


      if (!paymentRecord) {

        return res.status(404).json({

          success: false,

          message:
            "Payment order not found"

        });

      }


      // ==================================================
      // CHECK IF ALREADY PAID
      // ==================================================

      if (paymentRecord.status === "Paid") {

        return res.json({

          success: true,

          message:
            "Payment already verified",

          paymentId:
            paymentRecord.razorpay_payment_id

        });

      }


      // ==================================================
      // GENERATE SIGNATURE
      // ==================================================

      const generatedSignature =
        crypto
          .createHmac(
            "sha256",
            process.env.RAZORPAY_KEY_SECRET
          )
          .update(
            razorpay_order_id +
            "|" +
            razorpay_payment_id
          )
          .digest("hex");


      // ==================================================
      // VERIFY SIGNATURE
      // ==================================================

      if (
        generatedSignature !==
        razorpay_signature
      ) {

        console.error(
          "❌ PAYMENT SIGNATURE INVALID"
        );

        return res.status(400).json({

          success: false,

          message:
            "Payment verification failed"

        });

      }


      console.log(
        "✅ PAYMENT SIGNATURE VERIFIED:",
        razorpay_payment_id
      );


      // ==================================================
      // UPDATE PAYMENT
      // ==================================================

      db.run(
        `UPDATE payments
         SET
           razorpay_payment_id = ?,
           razorpay_signature = ?,
           status = ?
         WHERE razorpay_order_id = ?
         AND user_id = ?`,
        [
          razorpay_payment_id,
          razorpay_signature,
          "Paid",
          razorpay_order_id,
          userId
        ],
        function (paymentUpdateErr) {

          if (paymentUpdateErr) {

            console.error(
              "Payment update error:",
              paymentUpdateErr
            );

            return res.status(500).json({

              success: false,

              message:
                "Could not update payment"

            });

          }


          // ==================================================
          // UPDATE RENTAL REQUEST
          // ==================================================

          db.run(
            `UPDATE requests
             SET status = ?
             WHERE id = ?
             AND user_id = ?`,
            [
              "Paid",
              paymentRecord.request_id,
              userId
            ],
            function (requestUpdateErr) {

              if (requestUpdateErr) {

                console.error(
                  "Rental request update error:",
                  requestUpdateErr
                );

                return res.status(500).json({

                  success: false,

                  message:
                    "Payment verified but rental request could not be updated"

                });

              }


              console.log(
                "✅ RENTAL REQUEST MARKED AS PAID:",
                paymentRecord.request_id
              );


              // ==================================================
              // FINAL SUCCESS RESPONSE
              // ==================================================

              return res.json({

                success: true,

                message:
                  "Payment verified successfully",

                paymentId:
                  razorpay_payment_id,

                requestId:
                  paymentRecord.request_id

              });

            }
          );

        }
      );

    }
  );

});


module.exports = router;