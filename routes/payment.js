const express = require("express");
const crypto = require("crypto");

const router = express.Router();


// ======================================================
// FORMAT DATE AS YYYY-MM-DD
// ======================================================

function formatDate(date) {

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


// ======================================================
// ADD MONTHS TO DATE SAFELY
// ======================================================

function addMonths(date, months) {

  const result =
    new Date(date);

  const originalDay =
    result.getDate();

  result.setDate(1);

  result.setMonth(
    result.getMonth() + months
  );

  const lastDayOfMonth =
    new Date(
      result.getFullYear(),
      result.getMonth() + 1,
      0
    ).getDate();

  result.setDate(
    Math.min(
      originalDay,
      lastDayOfMonth
    )
  );

  return result;
}


// ======================================================
// PARSE YYYY-MM-DD AS LOCAL DATE
// ======================================================

function parseDateString(dateString) {

  const parts =
    dateString.split("-");

  if (parts.length !== 3) {
    return null;
  }

  const year =
    Number(parts[0]);

  const month =
    Number(parts[1]);

  const day =
    Number(parts[2]);

  const date =
    new Date(
      year,
      month - 1,
      day
    );

  // Make sure the date is actually valid

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}


// ======================================================
// CREATE RAZORPAY ORDER
// ======================================================

router.post(
  "/payment/create-order",
  (req, res) => {

    if (!req.session.user) {

      return res.redirect(
        "/login"
      );

    }


    const db =
      req.app.locals.db;

    const razorpay =
      req.app.locals.razorpay;


    const userId =
      req.session.user.id;

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
    // VALIDATE RENTAL DURATION
    // ==================================================

    if (
      !Number.isInteger(
        rentalMonths
      ) ||
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


    const parsedStartDate =
      parseDateString(
        rentalStartDate
      );


    if (!parsedStartDate) {

      return res.send(
        "Invalid rental start date"
      );

    }


    // ==================================================
    // PREVENT PAST START DATE
    // ==================================================

    const today =
      new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );


    if (
      parsedStartDate < today
    ) {

      return res.send(
        "Rental start date cannot be in the past"
      );

    }


    // ==================================================
    // GET PRODUCT
    // ==================================================

    db.get(
      "SELECT * FROM products WHERE id = ?",
      [productId],

      async (
        err,
        product
      ) => {

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


        const amountInPaise =
          totalAmount * 100;


        try {


          // ================================================
          // CREATE RAZORPAY ORDER
          // ================================================

          const order =
            await razorpay.orders.create({

              amount:
                amountInPaise,

              currency:
                "INR",

              receipt:
                `rental_${userId}_${Date.now()}`

            });


          console.log(
            "🔥 RAZORPAY ORDER CREATED:",
            order.id
          );


          // ================================================
          // CREATE RENTAL REQUEST
          // ================================================

          db.run(

            `INSERT INTO requests
            (
              user_id,
              product_id,
              rental_months,
              total_amount,
              status,
              rental_start_date
            )
            VALUES (?, ?, ?, ?, ?, ?)`,

            [
              userId,
              productId,
              rentalMonths,
              totalAmount,
              "Payment Pending",
              rentalStartDate
            ],

            function (
              requestErr
            ) {

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


              console.log(
                "📅 SELECTED START DATE:",
                rentalStartDate
              );


              // ==========================================
              // SAVE PAYMENT RECORD
              // ==========================================

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

                function (
                  paymentErr
                ) {

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


                  // ========================================
                  // PAYMENT PAGE
                  // ========================================

                  res.render(
                    "payment",
                    {

                      user:
                        req.session.user,

                      product:
                        product,

                      rentalMonths:
                        rentalMonths,

                      totalAmount:
                        totalAmount,

                      razorpayOrderId:
                        order.id,

                      razorpayKeyId:
                        req.app.locals
                          .razorpayKeyId

                    }
                  );

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

  }
);


// ======================================================
// VERIFY RAZORPAY PAYMENT
// ======================================================

router.post(
  "/payment/verify",
  (req, res) => {

    if (!req.session.user) {

      return res.status(401).json({

        success: false,

        message:
          "User not logged in"

      });

    }


    const db =
      req.app.locals.db;

    const userId =
      req.session.user.id;


    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;


    // ==================================================
    // VALIDATE PAYMENT RESPONSE
    // ==================================================

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


    // ==================================================
    // FIND PAYMENT + RENTAL
    // ==================================================

    db.get(

      `SELECT

        pay.*,

        r.rental_months,

        r.total_amount AS rental_total,

        r.rental_start_date

       FROM payments pay

       JOIN requests r
         ON pay.request_id = r.id

       WHERE pay.razorpay_order_id = ?

       AND pay.user_id = ?`,

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

        if (
          paymentRecord.status ===
          "Paid"
        ) {

          return res.json({

            success: true,

            message:
              "Payment already verified",

            paymentId:
              paymentRecord
                .razorpay_payment_id,

            requestId:
              paymentRecord
                .request_id,

            orderId:
              paymentRecord
                .razorpay_order_id,

            amount:
              paymentRecord.amount,

            currency:
              paymentRecord.currency,

            productId:
              paymentRecord.product_id

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

          function (
            paymentUpdateErr
          ) {

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
            // CALCULATE RENTAL DATES
            // ==================================================

            /*
             * IMPORTANT:
             *
             * The start date now comes from
             * the date selected by the user
             * on the Rental Details page.
             */

            const rentalStartDate =
              parseDateString(
                paymentRecord
                  .rental_start_date
              );


            if (!rentalStartDate) {

              console.error(
                "❌ INVALID STORED RENTAL START DATE:",
                paymentRecord
                  .rental_start_date
              );

              return res.status(500).json({

                success: false,

                message:
                  "Invalid rental start date"

              });

            }


            const rentalEndDate =
              addMonths(
                rentalStartDate,
                paymentRecord
                  .rental_months
              );


            const startDate =
              formatDate(
                rentalStartDate
              );


            const endDate =
              formatDate(
                rentalEndDate
              );


            console.log(
              "🔥 RENTAL START DATE:",
              startDate
            );


            console.log(
              "🔥 RENTAL END DATE:",
              endDate
            );


            // ==================================================
            // UPDATE RENTAL REQUEST
            // ==================================================

            db.run(

              `UPDATE requests

               SET
                 status = ?,
                 rental_start_date = ?,
                 rental_end_date = ?

               WHERE id = ?

               AND user_id = ?`,

              [
                "Paid",
                startDate,
                endDate,
                paymentRecord.request_id,
                userId
              ],

              function (
                requestUpdateErr
              ) {

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


                console.log(
                  "📅 RENTAL PERIOD:",
                  startDate,
                  "to",
                  endDate
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
                    paymentRecord.request_id,

                  orderId:
                    razorpay_order_id,

                  amount:
                    paymentRecord.amount,

                  currency:
                    paymentRecord.currency,

                  productId:
                    paymentRecord.product_id,

                  rentalStartDate:
                    startDate,

                  rentalEndDate:
                    endDate

                });

              }

            );

          }

        );

      }

    );

  }
);


// ======================================================
// PAYMENT SUCCESS PAGE
// ======================================================

router.get(
  "/payment/success",
  (req, res) => {

    if (!req.session.user) {

      return res.redirect(
        "/login"
      );

    }


    const db =
      req.app.locals.db;

    const userId =
      req.session.user.id;

    const requestId =
      req.query.request_id;


    // ==================================================
    // REQUEST ID REQUIRED
    // ==================================================

    if (!requestId) {

      return res.redirect(
        "/requests"
      );

    }


    // ==================================================
    // GET BOOKING + PAYMENT DETAILS
    // ==================================================

    db.get(

      `SELECT

        r.id AS request_id,

        r.rental_months,

        r.total_amount,

        r.status AS rental_status,

        r.request_date,

        r.rental_start_date,

        r.rental_end_date,

        p.name AS product_name,

        p.category,

        p.price AS monthly_price,

        pay.razorpay_order_id,

        pay.razorpay_payment_id,

        pay.amount AS paid_amount,

        pay.currency,

        pay.status AS payment_status

       FROM requests r

       JOIN products p
         ON r.product_id = p.id

       LEFT JOIN payments pay
         ON pay.request_id = r.id

       WHERE r.id = ?

       AND r.user_id = ?`,

      [
        requestId,
        userId
      ],

      (err, booking) => {

        if (err) {

          console.error(
            "Booking details error:",
            err
          );

          return res.send(
            "Error loading booking details"
          );

        }


        if (!booking) {

          return res.redirect(
            "/requests"
          );

        }


        // ==================================================
        // BACKFILL OLD BOOKINGS
        // ==================================================

        if (
          !booking.rental_start_date ||
          !booking.rental_end_date
        ) {

          console.log(
            "📅 OLD BOOKING DETECTED:",
            booking.request_id
          );


          // Existing bookings don't have
          // a selected start date.
          // Use their original request date.

          const rentalStartDate =
            new Date(
              booking.request_date
            );


          const rentalEndDate =
            addMonths(
              rentalStartDate,
              booking.rental_months
            );


          const startDate =
            formatDate(
              rentalStartDate
            );


          const endDate =
            formatDate(
              rentalEndDate
            );


          // ==============================================
          // SAVE DATES TO DATABASE
          // ==============================================

          db.run(

            `UPDATE requests

             SET
               rental_start_date = ?,
               rental_end_date = ?

             WHERE id = ?

             AND user_id = ?`,

            [
              startDate,
              endDate,
              requestId,
              userId
            ],

            (updateErr) => {

              if (updateErr) {

                console.error(
                  "Rental date update error:",
                  updateErr
                );

              } else {

                console.log(
                  "✅ OLD BOOKING DATES SAVED:",
                  startDate,
                  "to",
                  endDate
                );

              }

            }

          );


          // Update page immediately

          booking.rental_start_date =
            startDate;

          booking.rental_end_date =
            endDate;

        }


        // ==================================================
        // LOAD SUCCESS PAGE
        // ==================================================

        console.log(
          "🔥 BOOKING DETAILS LOADED:",
          booking.request_id
        );


        res.render(
          "payment-success",
          {

            user:
              req.session.user,

            booking:
              booking

          }
        );

      }

    );

  }
);


// ======================================================
// EXPORT ROUTER
// ======================================================

module.exports = router;