const express = require("express");
const multer = require("multer");
const path = require("path");
const mysql = require('mysql2/promise');
const fs = require('fs');
const db = require('../db'); 
const router = express.Router();

// Configure multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, "../../uploads/");
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
    },
});

// Configure multer upload
const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error("Only image files are allowed"));
        }
        cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 },
});

// Ensure 'uploads/invoices' directory exists
const invoiceDir = path.join(__dirname, "../uploads/invoices");
if (!fs.existsSync(invoiceDir)) {
    fs.mkdirSync(invoiceDir, { recursive: true });
}

// Invoice Upload Configuration
const invoiceStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, invoiceDir); // Save in /uploads/invoices
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname); // Keep invoice number as filename (e.g., INV001.pdf)
    },
});

const uploadInvoice = multer({ storage: invoiceStorage });

// Route to upload invoice PDF
router.post("/upload-invoice", uploadInvoice.single("invoice"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }
    res.json({ message: "Invoice uploaded successfully", file: req.file.filename });
});

// Helper functions
const padNumber = (num, size) => {
    let s = num + '';
    while (s.length < size) s = '0' + s;
    return s;
};

const sanitizeNumeric = (value) => {
    if (value === null || value === undefined || value === 'NaN') return 0;
    const num = parseFloat(value.toString().replace(/[^\d.]/g, ""));
    return isNaN(num) ? 0 : num;
};

router.post("/save-repair-details", upload.array("product_image", 10), async (req, res) => {
    try {
        const { repairDetails, oldItems = [], memberSchemes = [], salesNetAmount } = req.body;

        if (!Array.isArray(repairDetails) || repairDetails.length === 0) {
            return res.status(400).json({ message: "No data to save" });
        }

        const files = req.files || [];
        repairDetails.forEach((detail, index) => {
            detail.product_image = files[index]?.filename || null;
        });

        let currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        let originalInvoiceNumber = repairDetails[0].invoice_number;

        const invoiceRegex = /^([A-Za-z]+)(\d+)$/;
        const match = originalInvoiceNumber.match(invoiceRegex);

        if (!match) {
            return res.status(400).json({ message: "Invalid invoice number format" });
        }

        const prefix = match[1];
        const currentNumber = parseInt(match[2]);

        // Process customer details
        for (let item of repairDetails) {
            if (item.mobile) {
                const [existingCustomers] = await db.execute(
                    'SELECT account_id FROM account_details WHERE mobile = ?',
                    [item.mobile]
                );

                if (existingCustomers.length > 0) {
                    item.customer_id = existingCustomers[0].account_id;
                } else {
                    const [insertResult] = await db.execute(
                        `INSERT INTO account_details (
              account_name, mobile, email, address1, address2, 
              city, pincode, state, state_code, aadhar_card, 
              gst_in, pan_card, account_group
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            item.account_name || null,
                            item.mobile,
                            item.email || null,
                            item.address1 || null,
                            item.address2 || null,
                            item.city || null,
                            item.pincode || null,
                            item.state || null,
                            item.state_code || null,
                            item.aadhar_card || null,
                            item.gst_in || null,
                            item.pan_card || null,
                            'CUSTOMERS'
                        ]
                    );
                    item.customer_id = insertResult.insertId;
                }
            }
        }

        // Check existing invoice numbers
        const [existingInvoices] = await db.execute(
            `SELECT invoice_number FROM sale_details WHERE invoice_number LIKE ?`,
            [`${prefix}%`]
        );

        let maxNumber = currentNumber;
        existingInvoices.forEach(row => {
            const rowMatch = row.invoice_number.match(invoiceRegex);
            if (rowMatch && rowMatch[1] === prefix) {
                const num = parseInt(rowMatch[2]);
                if (num >= maxNumber) {
                    maxNumber = num;
                }
            }
        });

        const exists = existingInvoices.some(r => r.invoice_number === originalInvoiceNumber);
        const newInvoiceNumber = exists ?
            `${prefix}${padNumber(maxNumber + 1, 3)}` :
            originalInvoiceNumber;

        // Calculate amounts
        let totalAmount = 0, discountAmt = 0, festivalDiscountAmt = 0;
        let taxableAmount = 0, taxAmount = 0, netAmount = 0;

        repairDetails.forEach((item) => {
            const pricing = item.pricing;
            item.finalReceiptsAmt = item.receipts_amt === "" ? 0.0 : parseFloat(item.receipts_amt) || 0.0;
            item.finalBalAfterReceipts = item.bal_after_receipts === "" ? 0.0 : parseFloat(item.bal_after_receipts) || 0.0;

            const itemDiscount = parseFloat(item.disscount) || 0;
            const itemFestivalDiscount = parseFloat(item.festival_discount) || 0;
            const itemTax = parseFloat(item.tax_amt) || 0;

            if (pricing === "By Weight") {
                const stonePrice = parseFloat(item.stone_price) || 0;
                const makingCharges = parseFloat(item.making_charges) || 0;
                const rateAmt = parseFloat(item.rate_amt) || 0;
                const hmCharges = parseFloat(item.hm_charges) || 0;

                const itemTotal = stonePrice + makingCharges + rateAmt + hmCharges;
                totalAmount += itemTotal;
                discountAmt += itemDiscount;
                festivalDiscountAmt += itemFestivalDiscount;

                const totalDiscount = itemDiscount + itemFestivalDiscount;
                const itemTaxable = itemTotal - totalDiscount;

                taxableAmount += itemTaxable;
                taxAmount += itemTax;
                netAmount += itemTaxable + itemTax;
            } else {
                const pieceCost = parseFloat(item.pieace_cost) || 0;
                const qty = parseFloat(item.qty) || 0;

                const itemTotal = pieceCost * qty;
                totalAmount += itemTotal;
                discountAmt += itemDiscount;
                festivalDiscountAmt += itemFestivalDiscount;

                const totalDiscount = itemDiscount + itemFestivalDiscount;
                const itemTaxable = itemTotal - totalDiscount;

                taxableAmount += itemTaxable;
                taxAmount += itemTax;
                netAmount += itemTaxable + itemTax;
            }
        });

        const totalOldAmount = oldItems.reduce((sum, item) => sum + (parseFloat(item.total_amount) || 0), 0);
        const parsedSalesNetAmount = parseFloat(salesNetAmount) || 0;
        const schemesTotalAmount = memberSchemes.reduce((sum, scheme) => sum + (parseFloat(scheme.paid_amount) || 0), 0);

        // Process updates and inserts
        const existingIds = repairDetails.map(item => item.id).filter(id => id);
        const orderNumbers = repairDetails.map(item => item.order_number).filter(Boolean);

        if (existingIds.length > 0) {
            // FIXED: Proper handling of IN clause with arrays
            const placeholders = existingIds.map(() => '?').join(',');
            const [existingRows] = await db.execute(
                `SELECT id, order_number FROM sale_details WHERE id IN (${placeholders})`,
                existingIds
            );

            const existingIdsSet = new Set(existingRows.map(row => row.id));
            const itemsToInsert = [];
            const itemsToUpdate = [];

            repairDetails.forEach(item => {
                if (item.id && item.order_number && existingIdsSet.has(item.id)) {
                    item.invoice_number = newInvoiceNumber;
                    itemsToUpdate.push(item);

                    const newItem = { ...item };
                    delete newItem.id;
                    newItem.transaction_status = 'ConvertedInvoice';
                    itemsToInsert.push(newItem);
                } else if (item.id && existingIdsSet.has(item.id)) {
                    itemsToUpdate.push(item);
                } else {
                    itemsToInsert.push(item);
                }
            });

            // Update existing items
            for (let item of itemsToUpdate) {
                const cashAmount = parseFloat(item.cash_amount) || 0;
                const cardAmount = parseFloat(item.card_amt) || 0;
                const chqAmount = parseFloat(item.chq_amt) || 0;
                const onlineAmount = parseFloat(item.online_amt) || 0;

                const paidAmt = cashAmount + cardAmount + chqAmount + onlineAmount;
                const netBillAmount = netAmount - (totalOldAmount + schemesTotalAmount + parsedSalesNetAmount);
                const roundedNetBillAmount = Math.round(netBillAmount);
                const balAmt = roundedNetBillAmount - paidAmt;

                await db.execute(`
          UPDATE sale_details SET
            customer_id=?, mobile=?, account_name=?, email=?, address1=?, address2=?, city=?, pincode=?, 
            state=?, state_code=?, aadhar_card=?, gst_in=?, pan_card=?, terms=?, date=?, time=?, 
            code=?, product_id=?, opentag_id=?, metal=?, product_name=?, metal_type=?, design_name=?, 
            purity=?, selling_purity=?, printing_purity=?, custom_purity=?, pricing=?, category=?, 
            sub_category=?, gross_weight=?, stone_weight=?, weight_bw=?, stone_price=?, va_on=?, 
            va_percent=?, wastage_weight=?, total_weight_av=?, mc_on=?, mc_per_gram=?, making_charges=?, 
            disscount_percentage=?, disscount=?, festival_discount=?, rate=?, rate_24k=?, pieace_cost=?, 
            mrp_price=?, rate_amt=?, tax_percent=?, tax_amt=?, original_total_price=?, total_price=?, 
            cash_amount=?, card_amount=?, card_amt=?, chq=?, chq_amt=?, online=?, online_amt=?, 
            transaction_status=?, qty=?, product_image=COALESCE(?, product_image), imagePreview=?, 
            order_number=?, invoice=?, hm_charges=?, remarks=?, sale_status=?, invoice_number=?, 
            taxable_amount=?, tax_amount=?, net_amount=?, old_exchange_amt=?, scheme_amt=?, 
            sale_return_amt=?, receipts_amt=?, bal_after_receipts=?, bal_amt=?, net_bill_amount=?, 
            paid_amt=?, piece_taxable_amt=?, original_piece_taxable_amt=?
          WHERE id=?`,
                    [
                        item.customer_id, item.mobile, item.account_name, item.email, item.address1, item.address2,
                        item.city, item.pincode, item.state, item.state_code, item.aadhar_card, item.gst_in,
                        item.pan_card, item.terms, item.date, currentTime, item.code, item.product_id, item.opentag_id,
                        item.metal, item.product_name, item.metal_type, item.design_name, item.purity, item.selling_purity,
                        item.printing_purity, item.custom_purity, item.pricing, item.category, item.sub_category,
                        item.gross_weight, item.stone_weight, item.weight_bw, item.stone_price, item.va_on, item.va_percent,
                        item.wastage_weight, item.total_weight_av, item.mc_on, item.mc_per_gram, item.making_charges,
                        item.disscount_percentage, item.disscount, item.festival_discount, item.rate, item.rate_24k,
                        item.pieace_cost, item.mrp_price, item.rate_amt, sanitizeNumeric(item.tax_percent), item.tax_amt,
                        item.original_total_price, item.total_price, item.cash_amount, item.card_amount, item.card_amt,
                        item.chq, item.chq_amt, item.online, item.online_amt, item.transaction_status || "Sales",
                        item.qty, item.product_image, item.imagePreview, item.order_number, item.invoice, item.hm_charges,
                        item.remarks, item.sale_status, item.invoice_number, taxableAmount, taxAmount, netAmount,
                        totalOldAmount, schemesTotalAmount, parsedSalesNetAmount, item.finalReceiptsAmt,
                        item.finalBalAfterReceipts, balAmt, roundedNetBillAmount, paidAmt,
                        sanitizeNumeric(item.piece_taxable_amt), sanitizeNumeric(item.original_piece_taxable_amt), item.id
                    ]
                );
            }

            // Insert new items
            if (itemsToInsert.length > 0) {
                const insertValues = itemsToInsert.map(item => {
                    const cashAmount = parseFloat(item.cash_amount) || 0;
                    const cardAmount = parseFloat(item.card_amt) || 0;
                    const chqAmount = parseFloat(item.chq_amt) || 0;
                    const onlineAmount = parseFloat(item.online_amt) || 0;

                    const paidAmt = cashAmount + cardAmount + chqAmount + onlineAmount;
                    const netBillAmount = netAmount - (totalOldAmount + schemesTotalAmount + parsedSalesNetAmount);
                    const roundedNetBillAmount = Math.round(netBillAmount);
                    const balAmt = roundedNetBillAmount - paidAmt;

                    return [
                        item.id, item.customer_id, item.mobile, item.account_name, item.email, item.address1, item.address2,
                        item.city, item.pincode, item.state, item.state_code, item.aadhar_card, item.gst_in, item.pan_card,
                        item.terms, item.date, currentTime, newInvoiceNumber, item.code, item.product_id, item.opentag_id,
                        item.metal, item.product_name, item.metal_type, item.design_name, item.purity, item.selling_purity,
                        item.printing_purity, item.custom_purity, item.pricing, item.category, item.sub_category,
                        item.gross_weight, item.stone_weight, item.weight_bw, item.stone_price, item.va_on, item.va_percent,
                        item.wastage_weight, item.total_weight_av, item.mc_on, item.mc_per_gram, item.making_charges,
                        item.disscount_percentage, item.disscount, item.festival_discount, item.rate, item.rate_24k,
                        item.pieace_cost, item.mrp_price, item.rate_amt, sanitizeNumeric(item.tax_percent), item.tax_amt,
                        item.original_total_price, item.total_price, item.cash_amount, item.card_amount, item.card_amt,
                        item.chq, item.chq_amt, item.online, item.online_amt, item.transaction_status || "Sales",
                        item.qty, item.product_image, item.imagePreview, item.order_number, item.invoice, item.hm_charges,
                        item.remarks, item.sale_status, taxableAmount, taxAmount, netAmount, totalOldAmount,
                        schemesTotalAmount, parsedSalesNetAmount, item.finalReceiptsAmt, item.finalBalAfterReceipts,
                        balAmt, roundedNetBillAmount, paidAmt, sanitizeNumeric(item.piece_taxable_amt),
                        sanitizeNumeric(item.original_piece_taxable_amt)
                    ];
                });

                await db.query(`
          INSERT INTO sale_details (
            id, customer_id, mobile, account_name, email, address1, address2, city, pincode, state, state_code, 
            aadhar_card, gst_in, pan_card, terms, date, time, invoice_number, code, product_id, opentag_id, metal, 
            product_name, metal_type, design_name, purity, selling_purity, printing_purity, custom_purity, pricing, category, sub_category, 
            gross_weight, stone_weight, weight_bw, stone_price, va_on, va_percent, wastage_weight, total_weight_av, 
            mc_on, mc_per_gram, making_charges, disscount_percentage, disscount, festival_discount, rate, rate_24k, pieace_cost, mrp_price, 
            rate_amt, tax_percent, tax_amt, original_total_price, total_price, cash_amount, card_amount, card_amt, 
            chq, chq_amt, online, online_amt, transaction_status, qty, product_image, imagePreview, order_number, 
            invoice, hm_charges, remarks, sale_status, taxable_amount, tax_amount, net_amount, old_exchange_amt, 
            scheme_amt, sale_return_amt, receipts_amt, bal_after_receipts, bal_amt, net_bill_amount, paid_amt, 
            piece_taxable_amt, original_piece_taxable_amt
          ) VALUES ?`, [insertValues]);
            }

            // Update repairs table - FIXED: Proper handling of IN clause
            if (orderNumbers.length > 0) {
                const orderPlaceholders = orderNumbers.map(() => '?').join(',');
                await db.execute(
                    `UPDATE repairs SET invoice='Converted', status='Delivered to Customer', invoice_number=? WHERE repair_no IN (${orderPlaceholders})`,
                    [newInvoiceNumber, ...orderNumbers]
                );
            }

            await processRelatedTables(originalInvoiceNumber, repairDetails, oldItems, memberSchemes, totalOldAmount, schemesTotalAmount, existingIds.length > 0);
        } else {
            // Insert only new items
            const insertValues = repairDetails.map(item => {
                const cashAmount = parseFloat(item.cash_amount) || 0;
                const cardAmount = parseFloat(item.card_amt) || 0;
                const chqAmount = parseFloat(item.chq_amt) || 0;
                const onlineAmount = parseFloat(item.online_amt) || 0;

                const paidAmt = cashAmount + cardAmount + chqAmount + onlineAmount;
                const netBillAmount = netAmount - (totalOldAmount + schemesTotalAmount + parsedSalesNetAmount);
                const roundedNetBillAmount = Math.round(netBillAmount);
                const balAmt = roundedNetBillAmount - paidAmt;

                return [
                    item.id, item.customer_id, item.mobile, item.account_name, item.email, item.address1, item.address2,
                    item.city, item.pincode, item.state, item.state_code, item.aadhar_card, item.gst_in, item.pan_card,
                    item.terms, item.date, currentTime, newInvoiceNumber, item.code, item.product_id, item.opentag_id,
                    item.metal, item.product_name, item.metal_type, item.design_name, item.purity, item.selling_purity,
                    item.printing_purity, item.custom_purity, item.pricing, item.category, item.sub_category,
                    item.gross_weight, item.stone_weight, item.weight_bw, item.stone_price, item.va_on, item.va_percent,
                    item.wastage_weight, item.total_weight_av, item.mc_on, item.mc_per_gram, item.making_charges,
                    item.disscount_percentage, item.disscount, item.festival_discount, item.rate, item.rate_24k,
                    item.pieace_cost, item.mrp_price, item.rate_amt, sanitizeNumeric(item.tax_percent), item.tax_amt,
                    item.original_total_price, item.total_price, item.cash_amount, item.card_amount, item.card_amt,
                    item.chq, item.chq_amt, item.online, item.online_amt, item.transaction_status || "Sales",
                    item.qty, item.product_image, item.imagePreview, item.order_number, item.invoice, item.hm_charges,
                    item.remarks, item.sale_status, taxableAmount, taxAmount, netAmount, totalOldAmount,
                    schemesTotalAmount, parsedSalesNetAmount, item.finalReceiptsAmt, item.finalBalAfterReceipts,
                    balAmt, roundedNetBillAmount, paidAmt, sanitizeNumeric(item.piece_taxable_amt),
                    sanitizeNumeric(item.original_piece_taxable_amt)
                ];
            });

            await db.query(`
        INSERT INTO sale_details (
          id, customer_id, mobile, account_name, email, address1, address2, city, pincode, state, state_code, 
          aadhar_card, gst_in, pan_card, terms, date, time, invoice_number, code, product_id, opentag_id, metal, 
          product_name, metal_type, design_name, purity, selling_purity, printing_purity, custom_purity, pricing, category, sub_category, 
          gross_weight, stone_weight, weight_bw, stone_price, va_on, va_percent, wastage_weight, total_weight_av, 
          mc_on, mc_per_gram, making_charges, disscount_percentage, disscount, festival_discount, rate, rate_24k, pieace_cost, mrp_price, 
          rate_amt, tax_percent, tax_amt, original_total_price, total_price, cash_amount, card_amount, card_amt, 
          chq, chq_amt, online, online_amt, transaction_status, qty, product_image, imagePreview, order_number, 
          invoice, hm_charges, remarks, sale_status, taxable_amount, tax_amount, net_amount, old_exchange_amt, 
          scheme_amt, sale_return_amt, receipts_amt, bal_after_receipts, bal_amt, net_bill_amount, paid_amt, 
          piece_taxable_amt, original_piece_taxable_amt
        ) VALUES ?`, [insertValues]);

            // Update repairs table - FIXED: Proper handling of IN clause
            if (orderNumbers.length > 0) {
                const orderPlaceholders = orderNumbers.map(() => '?').join(',');
                await db.execute(
                    `UPDATE repairs SET invoice='Converted', status='Delivered to Customer', invoice_number=? WHERE repair_no IN (${orderPlaceholders})`,
                    [newInvoiceNumber, ...orderNumbers]
                );
            }

            await processRelatedTables(newInvoiceNumber, repairDetails, oldItems, memberSchemes, totalOldAmount, schemesTotalAmount, false);
        }

        res.json({ message: "Data saved successfully", invoice_number: newInvoiceNumber });

    } catch (error) {
        console.error("Error processing request:", error);
        res.status(500).json({ message: "Error saving data to the database" });
    }
});

async function processRelatedTables(invoiceNumber, repairDetails, oldItems, memberSchemes, totalOldAmount, schemesTotalAmount, isUpdate) {
    // Insert old_items
    if (oldItems.length > 0) {
        const oldItemsValues = oldItems.map(item => [
            item.id, invoiceNumber, item.product, item.metal, item.purity, item.hsn_code,
            item.gross, item.dust, item.ml_percent, item.net_wt, item.remarks, item.rate,
            item.total_amount, totalOldAmount
        ]);

        await db.query(`
      INSERT INTO old_items (
        id, invoice_id, product, metal, purity, hsn_code, gross, dust, ml_percent,
        net_wt, remarks, rate, total_amount, total_old_amount
      ) VALUES ?
      ON DUPLICATE KEY UPDATE
        invoice_id=VALUES(invoice_id), product=VALUES(product), metal=VALUES(metal),
        purity=VALUES(purity), hsn_code=VALUES(hsn_code), gross=VALUES(gross),
        dust=VALUES(dust), ml_percent=VALUES(ml_percent), net_wt=VALUES(net_wt),
        remarks=VALUES(remarks), rate=VALUES(rate), total_amount=VALUES(total_amount),
        total_old_amount=VALUES(total_old_amount)`, [oldItemsValues]);
    }

    // Insert member_schemes
    if (memberSchemes.length > 0) {
        const memberSchemesValues = memberSchemes.map(scheme => [
            scheme.id, invoiceNumber, scheme.scheme, scheme.member_name, scheme.member_number,
            scheme.scheme_name, scheme.installments_paid, scheme.duration_months, scheme.paid_months,
            scheme.pending_months, scheme.pending_amount, scheme.paid_amount, schemesTotalAmount
        ]);

        await db.query(`
      INSERT INTO member_schemes (
        id, invoice_id, scheme, member_name, member_number, scheme_name,
        installments_paid, duration_months, paid_months, pending_months, pending_amount,
        paid_amount, schemes_total_amount
      ) VALUES ?
      ON DUPLICATE KEY UPDATE
        invoice_id=VALUES(invoice_id), scheme=VALUES(scheme), member_name=VALUES(member_name),
        member_number=VALUES(member_number), scheme_name=VALUES(scheme_name),
        installments_paid=VALUES(installments_paid), duration_months=VALUES(duration_months),
        paid_months=VALUES(paid_months), pending_months=VALUES(pending_months),
        pending_amount=VALUES(pending_amount), paid_amount=VALUES(paid_amount),
        schemes_total_amount=VALUES(schemes_total_amount)`, [memberSchemesValues]);
    }

    // Update opening_tags_entry status
    for (let item of repairDetails) {
        if (item.transaction_status === "Sales" && item.opentag_id) {
            await db.execute(
                `UPDATE opening_tags_entry SET Status='Sold' WHERE opentag_id=?`,
                [item.opentag_id]
            );
        }
    }

    // Update product table for new sales
    if (!isUpdate) {
        const aggregatedUpdates = repairDetails.reduce((acc, item) => {
            if (item.transaction_status === "Sales" && item.product_id) {
                if (!acc[item.product_id]) {
                    acc[item.product_id] = { qty: 0, grossWeight: 0, pricing: item.pricing };
                }
                acc[item.product_id].qty += parseFloat(item.qty) || 0;
                if (item.pricing === "By Weight") {
                    acc[item.product_id].grossWeight += parseFloat(item.gross_weight) || 0;
                }
            }
            return acc;
        }, {});

        for (let [productId, { qty, grossWeight, pricing }] of Object.entries(aggregatedUpdates)) {
            if (pricing === "By Weight") {
                await db.execute(
                    `UPDATE product SET sale_qty=IFNULL(sale_qty,0)+?, sale_weight=IFNULL(sale_weight,0)+? WHERE product_id=?`,
                    [qty, grossWeight, productId]
                );
            } else {
                await db.execute(
                    `UPDATE product SET sale_qty=IFNULL(sale_qty,0)+? WHERE product_id=?`,
                    [qty, productId]
                );
            }

            await db.execute(
                `UPDATE product SET bal_qty=pur_qty-IFNULL(sale_qty,0), bal_weight=pur_weight-IFNULL(sale_weight,0) WHERE product_id=?`,
                [productId]
            );
        }
    }
}

// Get unique repair details
router.get("/get-unique-repair-details", async (req, res) => {
    try {
        const [results] = await db.execute(`
      SELECT * 
      FROM sale_details r1
      WHERE r1.id = (
        SELECT MAX(r2.id) 
        FROM sale_details r2
        WHERE r1.invoice_number = r2.invoice_number
      )
    `);
        res.json(results);
    } catch (err) {
        console.error("Error fetching data:", err);
        res.status(500).json({ message: "Error fetching data" });
    }
});

// Get repair details by invoice number
router.get("/get-repair-details/:invoice_number", async (req, res) => {
    try {
        const { invoice_number } = req.params;

        if (!invoice_number) {
            return res.status(400).json({ message: "Invoice number is required" });
        }

        const [results] = await db.execute(
            `SELECT * FROM sale_details WHERE invoice_number = ?`,
            [invoice_number]
        );

        if (results.length === 0) {
            return res.status(404).json({ message: "No data found for the given invoice number" });
        }

        const uniqueData = {
            customer_id: results[0].customer_id,
            mobile: results[0].mobile,
            account_name: results[0].account_name,
            email: results[0].email,
            address1: results[0].address1,
            address2: results[0].address2,
            city: results[0].city,
            pincode: results[0].pincode,
            state: results[0].state,
            state_code: results[0].state_code,
            aadhar_card: results[0].aadhar_card,
            gst_in: results[0].gst_in,
            pan_card: results[0].pan_card,
            terms: results[0].terms,
            date: results[0].date,
            time: results[0].time,
            invoice_number: results[0].invoice_number,
            order_number: results[0].order_number,
            cash_amount: results[0].cash_amount,
            card_amount: results[0].card_amount,
            card_amt: results[0].card_amt,
            chq: results[0].chq,
            chq_amt: results[0].chq_amt,
            online: results[0].online,
            online_amt: results[0].online_amt,
            transaction_status: results[0].transaction_status,
            qty: results[0].qty,
            taxable_amount: results[0].taxable_amount,
            tax_amount: results[0].tax_amount,
            net_amount: results[0].net_amount,
            invoice: results[0].invoice,
            disscount_percentage: results[0].disscount_percentage,
        };

        const repeatedData = results.map(row => ({
            id: row.id,
            customer_id: row.customer_id,
            mobile: row.mobile,
            account_name: row.account_name,
            email: row.email,
            address1: row.address1,
            address2: row.address2,
            city: row.city,
            pincode: row.pincode,
            state: row.state,
            state_code: row.state_code,
            aadhar_card: row.aadhar_card,
            gst_in: row.gst_in,
            pan_card: row.pan_card,
            terms: row.terms,
            date: row.date,
            time: row.time,
            invoice_number: row.invoice_number,
            code: row.code,
            product_id: row.product_id,
            opentag_id: row.opentag_id,
            metal: row.metal,
            product_name: row.product_name,
            metal_type: row.metal_type,
            design_name: row.design_name,
            purity: row.purity,
            selling_purity: row.selling_purity,
            printing_purity: row.printing_purity,
            custom_purity: row.custom_purity,
            pricing: row.pricing,
            category: row.category,
            sub_category: row.sub_category,
            gross_weight: row.gross_weight,
            stone_weight: row.stone_weight,
            weight_bw: row.weight_bw,
            stone_price: row.stone_price,
            va_on: row.va_on,
            va_percent: row.va_percent,
            wastage_weight: row.wastage_weight,
            total_weight_av: row.total_weight_av,
            mc_on: row.mc_on,
            mc_per_gram: row.mc_per_gram,
            making_charges: row.making_charges,
            disscount_percentage: row.disscount_percentage,
            disscount: row.disscount,
            festival_discount: row.festival_discount,
            rate: row.rate,
            rate_24k: row.rate_24k,
            pieace_cost: row.pieace_cost,
            mrp_price: row.mrp_price,
            rate_amt: row.rate_amt,
            tax_percent: row.tax_percent,
            tax_amt: row.tax_amt,
            original_total_price: row.original_total_price,
            total_price: row.total_price,
            cash_amount: row.cash_amount,
            card_amount: row.card_amount,
            card_amt: row.card_amt,
            chq: row.chq,
            chq_amt: row.chq_amt,
            online: row.online,
            online_amt: row.online_amt,
            transaction_status: row.transaction_status,
            qty: row.qty,
            product_image: row.product_image ? `/uploads/${row.product_image}` : null,
            imagePreview: row.imagePreview,
            order_number: row.order_number,
            invoice: row.invoice,
            hm_charges: row.hm_charges,
            remarks: row.remarks,
            sale_status: row.sale_status,
            taxable_amount: row.taxable_amount,
            tax_amount: row.tax_amount,
            net_amount: row.net_amount,
            old_exchange_amt: row.old_exchange_amt,
            scheme_amt: row.scheme_amt,
            sale_return_amt: row.sale_return_amt,
            receipts_amt: row.receipts_amt,
            bal_after_receipts: row.bal_after_receipts,
            bal_amt: row.bal_amt,
            net_bill_amount: row.net_bill_amount,
            paid_amt: row.paid_amt,
            piece_taxable_amt: row.piece_taxable_amt,
            original_piece_taxable_amt: row.original_piece_taxable_amt
        }));

        res.json({ uniqueData, repeatedData });
    } catch (err) {
        console.error("Error fetching data:", err);
        res.status(500).json({ message: "Error fetching data" });
    }
});

// Get all repair details by invoice number
router.get("/getsales/:invoice_number", async (req, res) => {
    try {
        const { invoice_number } = req.params;

        if (!invoice_number) {
            return res.status(400).json({ message: "Invoice number is required" });
        }

        const [results] = await db.execute(
            `SELECT * FROM sale_details WHERE invoice_number = ?`,
            [invoice_number]
        );

        if (results.length === 0) {
            return res.status(404).json({ message: "No repair details found for the given invoice number" });
        }

        res.json(results);
    } catch (err) {
        console.error("Database error:", err);
        res.status(500).json({ message: "Error fetching data from the database" });
    }
});

// Get all repair details
router.get("/get/repair-details", async (req, res) => {
    try {
        const [results] = await db.execute('SELECT * FROM sale_details');
        res.status(200).json(results);
    } catch (err) {
        console.error('Error fetching data:', err.message);
        res.status(500).json({ message: 'Failed to fetch data', error: err.message });
    }
});

router.delete('/repair-details/:invoiceNumber', async (req, res) => {
    const { invoiceNumber } = req.params;
    const { skipMessage } = req.query;

    if (!invoiceNumber) {
        return res.status(400).json({ message: 'Invoice number is required' });
    }

    let connection;
    try {
        // Get connection for transaction
        connection = await db.getConnection();
        await connection.beginTransaction();


        // 1️⃣ Get sale details with transaction status
        const [saleDetails] = await connection.execute(
            `SELECT opentag_id, product_id, qty, gross_weight, transaction_status 
       FROM sale_details 
       WHERE invoice_number = ?`,
            [invoiceNumber]
        );

        if (saleDetails.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'No sale details found for this invoice' });
        }


        const transactionStatus = saleDetails[0].transaction_status;
        const validStatuses = ['Sales', 'ConvertedInvoice', 'ConvertedRepairInvoice'];

        if (!validStatuses.includes(transactionStatus)) {
            await connection.rollback();
            return res.status(400).json({
                message: `Cannot delete invoice with transaction status: ${transactionStatus}`
            });
        }

        // 2️⃣ If transaction status is 'Sales', update product quantities
        if (transactionStatus === 'Sales') {
            const opentagIds = saleDetails.map(row => row.opentag_id).filter(id => id);

            // Update products
            for (const detail of saleDetails) {
                if (detail.product_id) {
                    await connection.execute(
                        `UPDATE product 
             SET 
               sale_qty = sale_qty - ?,
               sale_weight = sale_weight - ?,
               bal_qty = pur_qty - sale_qty,
               bal_weight = pur_weight - sale_weight
             WHERE product_id = ?`,
                        [detail.qty || 0, detail.gross_weight || 0, detail.product_id]
                    );

                }
            }

            // 3️⃣ Update opening_tags_entry status if opentagIds exist
            if (opentagIds.length > 0) {
                const placeholders = opentagIds.map(() => '?').join(',');
                await connection.execute(
                    `UPDATE opening_tags_entry SET Status = 'Available' WHERE opentag_id IN (${placeholders})`,
                    opentagIds
                );

            }
        }

        // 4️⃣ Delete old_items
        await connection.execute(
            'DELETE FROM old_items WHERE invoice_id = ?',
            [invoiceNumber]
        );


        // 5️⃣ Delete sale_details
        const [deleteResult] = await connection.execute(
            `DELETE FROM sale_details 
       WHERE invoice_number = ? 
       AND transaction_status IN ('Sales', 'ConvertedInvoice', 'ConvertedRepairInvoice')`,
            [invoiceNumber]
        );


        // Commit transaction
        await connection.commit();

        if (skipMessage === 'true') {
            return res.sendStatus(204);
        }

        res.status(200).json({
            message: 'Sale details deleted successfully',
            deletedRows: deleteResult.affectedRows
        });

    } catch (error) {
        // Rollback transaction in case of error
        if (connection) {
            await connection.rollback();
        }
        console.error('Error deleting repair details:', error);
        res.status(500).json({
            message: 'Failed to delete sale details',
            error: error.message
        });
    } finally {
        // Release connection back to pool
        if (connection) {
            connection.release();
        }
    }
});

module.exports = router;

