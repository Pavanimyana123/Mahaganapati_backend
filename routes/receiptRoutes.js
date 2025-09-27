const express = require('express');
const db = require('../db');

const router = express.Router();

// Add Payment (Receipt) API
router.post('/post/receipts', async (req, res) => {
    try {
        const {
            date, mode, transaction_type, cheque_number, receipt_no, account_name, invoice_number,
            total_amt, discount_amt, cash_amt, remarks, total_wt, paid_wt, bal_wt, category, mobile
        } = req.body;

        // Check for required fields
        if (!transaction_type || !date || !receipt_no || !account_name || !invoice_number) {
            return res.status(400).json({ error: 'Required fields are missing.' });
        }

        // Only process if transaction_type is 'Receipt'
        if (transaction_type !== 'Receipt') {
            return res.status(400).json({ error: 'This API only processes Receipt transactions.' });
        }

        // Ensure all values are properly handled (convert undefined to null or 0)
        const modeValue = mode && mode.trim() !== '' ? mode : null;
        const chequeNumberValue = cheque_number && cheque_number.trim() !== '' ? cheque_number : null;
        const remarksValue = remarks && remarks.trim() !== '' ? remarks : null;
        
        // Convert numeric values to proper numbers (0 instead of undefined)
        const totalAmtValue = total_amt ? Number(total_amt) : 0;
        const discountAmtValue = discount_amt ? Number(discount_amt) : 0;
        const cashAmtValue = cash_amt ? Number(cash_amt) : 0;
        const totalWtValue = total_wt ? Number(total_wt) : 0;
        const paidWtValue = paid_wt ? Number(paid_wt) : 0;
        const balWtValue = bal_wt ? Number(bal_wt) : 0;

        // Prepare data for payment insertion - ensure no undefined values
        const paymentData = [
            transaction_type, 
            date, 
            modeValue, 
            chequeNumberValue, 
            receipt_no,
            account_name, 
            invoice_number, 
            totalAmtValue, 
            discountAmtValue, 
            cashAmtValue,
            remarksValue, 
            totalWtValue, 
            paidWtValue, 
            balWtValue, 
            category || null, 
            mobile || null
        ];

        // Validate that no values are undefined
        if (paymentData.some(value => value === undefined)) {
            return res.status(400).json({ error: 'Some required fields contain undefined values.' });
        }

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Insert payment record - Using 'receipts' table instead of 'receipts'
            const paymentQuery = `
                INSERT INTO receipts (
                    transaction_type, date, mode, cheque_number, receipt_no, 
                    account_name, invoice_number, total_amt, discount_amt, cash_amt, 
                    remarks, total_wt, paid_wt, bal_wt, category, mobile
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const [paymentResult] = await connection.execute(paymentQuery, paymentData);

            // Update sale_details for Receipt transaction
            const updateReceiptsAmtQuery = `
                UPDATE sale_details
                SET receipts_amt = COALESCE(receipts_amt, 0) + ?
                WHERE invoice_number = ?
            `;
            await connection.execute(updateReceiptsAmtQuery, [discountAmtValue, invoice_number]);

            const updateBalAfterReceiptsQuery = `
                UPDATE sale_details
                SET bal_after_receipts = bal_amt - receipts_amt
                WHERE invoice_number = ?
            `;
            await connection.execute(updateBalAfterReceiptsQuery, [invoice_number]);

            await connection.commit();
            connection.release();

            res.status(201).json({
                message: 'Receipt record added and sale details updated successfully.',
                receiptId: paymentResult.insertId,
            });

        } catch (error) {
            await connection.rollback();
            connection.release();
            console.error('Database error adding receipt:', error.message);
            res.status(500).json({ error: 'Failed to process receipt.', details: error.message });
        }

    } catch (error) {
        console.error('Error adding receipt:', error.message);
        res.status(500).json({ error: 'Failed to process receipt.', details: error.message });
    }
});


// Get All Payments API
router.get('/get/receipts', async (req, res) => {
    try {
        const { date, mode, account_name } = req.query;

        let query = 'SELECT * FROM receipts WHERE 1=1';
        const values = [];

        if (date) {
            query += ' AND date = ?';
            values.push(date);
        }
        if (mode) {
            query += ' AND mode = ?';
            values.push(mode);
        }
        if (account_name) {
            query += ' AND account_name LIKE ?';
            values.push(`%${account_name}%`);
        }

        const [results] = await db.execute(query, values);
        res.status(200).json({ receipts: results });

    } catch (error) {
        console.error('Error retrieving payment records:', error.message);
        res.status(500).json({ error: 'Failed to retrieve payment records.' });
    }
});

// Get Payment by ID API
router.get('/get/receipt/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ error: 'Payment ID is required' });
        }

        const [results] = await db.execute('SELECT * FROM receipts WHERE id = ?', [id]);

        if (results.length === 0) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        res.status(200).json({ payment: results[0] });

    } catch (error) {
        console.error('Error retrieving payment record:', error.message);
        res.status(500).json({ error: 'Failed to retrieve payment record.' });
    }
});

// Update Payment (Receipt) API
router.put('/edit/receipt/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            transaction_type, date, mode, cheque_number, receipt_no, account_name, invoice_number,
            total_amt, discount_amt, cash_amt, remarks, category, mobile
        } = req.body;

        if (!id) {
            return res.status(400).json({ error: 'Payment ID is required.' });
        }

        // Only allow updates for Receipt transactions
        if (transaction_type && transaction_type !== 'Receipt') {
            return res.status(400).json({ error: 'This API only updates Receipt transactions.' });
        }

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Fetch existing payment details first
            const [existingPayment] = await connection.execute(
                'SELECT discount_amt, cash_amt, invoice_number FROM receipts WHERE id = ?',
                [id]
            );

            if (existingPayment.length === 0) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({ error: 'Payment record not found.' });
            }

            const { discount_amt: oldDiscount, invoice_number } = existingPayment[0];

            // First update in sale_details (reverse old values)
            const updateRepairDetails1 = `
                UPDATE sale_details 
                SET bal_after_receipts = bal_after_receipts + ?, receipts_amt = receipts_amt - ? 
                WHERE invoice_number = ?
            `;
            await connection.execute(updateRepairDetails1, [oldDiscount, oldDiscount, invoice_number]);

            // Second update with new values
            const updateRepairDetails2 = `
                UPDATE sale_details 
                SET bal_after_receipts = bal_after_receipts - ?, receipts_amt = receipts_amt + ? 
                WHERE invoice_number = ?
            `;
            await connection.execute(updateRepairDetails2, [discount_amt || 0, discount_amt || 0, invoice_number]);

            // Update the receipts table
            const updates = [];
            const values = [];

            if (transaction_type) updates.push('transaction_type = ?'), values.push(transaction_type);
            if (date) updates.push('date = ?'), values.push(date);
            if (mode) updates.push('mode = ?'), values.push(mode);
            if (cheque_number) updates.push('cheque_number = ?'), values.push(cheque_number);
            if (receipt_no) updates.push('receipt_no = ?'), values.push(receipt_no);
            if (account_name) updates.push('account_name = ?'), values.push(account_name);
            if (invoice_number) updates.push('invoice_number = ?'), values.push(invoice_number);
            if (total_amt) updates.push('total_amt = ?'), values.push(total_amt);
            if (discount_amt) updates.push('discount_amt = ?'), values.push(discount_amt);
            if (cash_amt) updates.push('cash_amt = ?'), values.push(cash_amt);
            if (remarks) updates.push('remarks = ?'), values.push(remarks);
            if (category) updates.push('category = ?'), values.push(category);
            if (mobile) updates.push('mobile = ?'), values.push(mobile);

            if (updates.length === 0) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({ error: 'No fields provided for update.' });
            }

            values.push(id);
            const updatePaymentQuery = `UPDATE receipts SET ${updates.join(', ')} WHERE id = ?`;
            const [result] = await connection.execute(updatePaymentQuery, values);

            if (result.affectedRows === 0) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({ error: 'Payment record not found.' });
            }

            await connection.commit();
            connection.release();
            res.status(200).json({ message: 'Payment record updated successfully.' });

        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }

    } catch (error) {
        console.error('Error updating payment record:', error.message);
        res.status(500).json({ error: 'Failed to update payment record.' });
    }
});

// Delete Payment (Receipt) API
router.delete('/delete/receipt/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(id)) {
            return res.status(400).json({ error: 'Invalid or missing payment ID.' });
        }

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Get the invoice_number and discount_amt of the payment to be deleted
            const [paymentRecord] = await connection.execute(
                'SELECT invoice_number, discount_amt FROM receipts WHERE id = ?',
                [id]
            );

            if (paymentRecord.length === 0) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({ error: 'Payment record not found.' });
            }

            const { invoice_number, discount_amt } = paymentRecord[0];

            // Update sale_details with new receipts_amt and bal_after_receipts
            const updateRepairDetailsQuery = `
                UPDATE sale_details 
                SET receipts_amt = receipts_amt - ?, 
                    bal_after_receipts = bal_after_receipts + ? 
                WHERE invoice_number = ?`;

            await connection.execute(updateRepairDetailsQuery, [discount_amt, discount_amt, invoice_number]);

            // Delete the payment record
            const [deleteResult] = await connection.execute('DELETE FROM receipts WHERE id = ?', [id]);

            if (deleteResult.affectedRows === 0) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({ error: 'Payment record not found.' });
            }

            await connection.commit();
            connection.release();
            res.status(200).json({ message: 'Payment record deleted successfully and repair details updated.' });

        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }

    } catch (error) {
        console.error('Error deleting payment record:', error.message);
        res.status(500).json({ error: 'Failed to delete payment record.' });
    }
});

// Add Order Payment (Receipt) API
router.post('/post/orderpayments', async (req, res) => {
    try {
        const {
            date, mode, transaction_type, cheque_number, receipt_no, account_name, invoice_number,
            total_amt, discount_amt, cash_amt, remarks, total_wt, paid_wt, bal_wt, category, mobile
        } = req.body;

        // Check for required fields
        if (!transaction_type || !date || !receipt_no || !account_name || !invoice_number) {
            return res.status(400).json({ error: 'Required fields are missing.' });
        }

        // Only process if transaction_type is 'Receipt'
        if (transaction_type !== 'Receipt') {
            return res.status(400).json({ error: 'This API only processes Receipt transactions.' });
        }

        const modeValue = mode && mode.trim() !== '' ? mode : null;

        const paymentData = [
            transaction_type, date, modeValue, cheque_number || null, receipt_no,
            account_name, invoice_number, total_amt || 0, discount_amt || 0, cash_amt || 0,
            remarks || null, total_wt || 0, paid_wt || 0, bal_wt || 0, category, mobile
        ];

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Insert payment record
            const paymentQuery = `
                INSERT INTO receipts (
                    transaction_type, date, mode, cheque_number, receipt_no, 
                    account_name, invoice_number, total_amt, discount_amt, cash_amt, 
                    remarks, total_wt, paid_wt, bal_wt, category, mobile
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const [paymentResult] = await connection.execute(paymentQuery, paymentData);

            // Update sale_details for order Receipt transaction
            const updateReceiptsAmtQuery = `
                UPDATE sale_details
                SET receipts_amt = COALESCE(receipts_amt, 0) + ?
                WHERE order_number = ?
            `;
            await connection.execute(updateReceiptsAmtQuery, [discount_amt || 0, invoice_number]);

            const updateBalAfterReceiptsQuery = `
                UPDATE sale_details
                SET bal_after_receipts = bal_amt - receipts_amt
                WHERE order_number = ?
            `;
            await connection.execute(updateBalAfterReceiptsQuery, [invoice_number]);

            await connection.commit();
            connection.release();

            res.status(201).json({
                message: 'Order payment record added and repair details updated successfully.',
                paymentId: paymentResult.insertId,
            });

        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }

    } catch (error) {
        console.error('Error adding order payment:', error.message);
        res.status(500).json({ error: 'Failed to process order payment.', details: error.message });
    }
});

// Update Order Payment (Receipt) API
router.put('/edit/orderreceipt/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            transaction_type, date, mode, cheque_number, receipt_no, account_name, invoice_number,
            total_amt, discount_amt, cash_amt, remarks, category, mobile
        } = req.body;

        if (!id) {
            return res.status(400).json({ error: 'Payment ID is required.' });
        }

        // Only allow updates for Receipt transactions
        if (transaction_type && transaction_type !== 'Receipt') {
            return res.status(400).json({ error: 'This API only updates Receipt transactions.' });
        }

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Fetch existing payment details
            const [existingPayment] = await connection.execute(
                'SELECT discount_amt, cash_amt, invoice_number FROM receipts WHERE id = ?',
                [id]
            );

            if (existingPayment.length === 0) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({ error: 'Payment record not found.' });
            }

            const { discount_amt: oldDiscount, invoice_number } = existingPayment[0];

            // First update in sale_details (reverse old values)
            const updateRepairDetails1 = `
                UPDATE sale_details 
                SET bal_after_receipts = bal_after_receipts + ?, receipts_amt = receipts_amt - ? 
                WHERE order_number = ?
            `;
            await connection.execute(updateRepairDetails1, [oldDiscount, oldDiscount, invoice_number]);

            // Second update with new values
            const updateRepairDetails2 = `
                UPDATE sale_details 
                SET bal_after_receipts = bal_after_receipts - ?, receipts_amt = receipts_amt + ? 
                WHERE order_number = ?
            `;
            await connection.execute(updateRepairDetails2, [discount_amt || 0, discount_amt || 0, invoice_number]);

            // Update the receipts table
            const updates = [];
            const values = [];

            if (transaction_type) updates.push('transaction_type = ?'), values.push(transaction_type);
            if (date) updates.push('date = ?'), values.push(date);
            if (mode) updates.push('mode = ?'), values.push(mode);
            if (cheque_number) updates.push('cheque_number = ?'), values.push(cheque_number);
            if (receipt_no) updates.push('receipt_no = ?'), values.push(receipt_no);
            if (account_name) updates.push('account_name = ?'), values.push(account_name);
            if (invoice_number) updates.push('invoice_number = ?'), values.push(invoice_number);
            if (total_amt) updates.push('total_amt = ?'), values.push(total_amt);
            if (discount_amt) updates.push('discount_amt = ?'), values.push(discount_amt);
            if (cash_amt) updates.push('cash_amt = ?'), values.push(cash_amt);
            if (remarks) updates.push('remarks = ?'), values.push(remarks);
            if (category) updates.push('category = ?'), values.push(category);
            if (mobile) updates.push('mobile = ?'), values.push(mobile);

            if (updates.length === 0) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({ error: 'No fields provided for update.' });
            }

            values.push(id);
            const updatePaymentQuery = `UPDATE receipts SET ${updates.join(', ')} WHERE id = ?`;
            const [result] = await connection.execute(updatePaymentQuery, values);

            if (result.affectedRows === 0) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({ error: 'Payment record not found.' });
            }

            await connection.commit();
            connection.release();
            res.status(200).json({ message: 'Order payment record updated successfully.' });

        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }

    } catch (error) {
        console.error('Error updating order payment record:', error.message);
        res.status(500).json({ error: 'Failed to update order payment record.' });
    }
});

// Delete Order Payment (Receipt) API
router.delete('/delete/orderreceipt/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(id)) {
            return res.status(400).json({ error: 'Invalid or missing payment ID.' });
        }

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Get the invoice_number and discount_amt of the payment to be deleted
            const [paymentRecord] = await connection.execute(
                'SELECT invoice_number, discount_amt FROM receipts WHERE id = ?',
                [id]
            );

            if (paymentRecord.length === 0) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({ error: 'Payment record not found.' });
            }

            const { invoice_number, discount_amt } = paymentRecord[0];

            // Update sale_details with new receipts_amt and bal_after_receipts
            const updateRepairDetailsQuery = `
                UPDATE sale_details 
                SET receipts_amt = receipts_amt - ?, 
                    bal_after_receipts = bal_after_receipts + ? 
                WHERE order_number = ?`;

            await connection.execute(updateRepairDetailsQuery, [discount_amt, discount_amt, invoice_number]);

            // Delete the payment record
            const [deleteResult] = await connection.execute('DELETE FROM receipts WHERE id = ?', [id]);

            if (deleteResult.affectedRows === 0) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({ error: 'Payment record not found.' });
            }

            await connection.commit();
            connection.release();
            res.status(200).json({ message: 'Order payment record deleted successfully and repair details updated.' });

        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }

    } catch (error) {
        console.error('Error deleting order payment record:', error.message);
        res.status(500).json({ error: 'Failed to delete order payment record.' });
    }
});

router.get("/lastReceiptNumber", async (req, res) => {
    try {
        const query = "SELECT receipt_no FROM receipts WHERE receipt_no LIKE 'RCP%' ORDER BY id DESC";
        const [result] = await db.execute(query);

        let nextReceiptNumber = "RCP001"; // Default if no receipts are found
        if (result.length > 0) {
            const rcpNumbers = result
                .map(row => row.receipt_no)
                .filter(receipt => receipt && receipt.startsWith("RCP")) // Ensure valid format
                .map(receipt => parseInt(receipt.slice(3), 10)); // Extract numeric part

            const lastReceiptNumber = rcpNumbers.length > 0 ? Math.max(...rcpNumbers) : 0;
            nextReceiptNumber = `RCP${String(lastReceiptNumber + 1).padStart(3, "0")}`;
        }

        res.json({ lastReceiptNumber: nextReceiptNumber });
    } catch (err) {
        console.error("Error fetching last receipt number:", err);
        res.status(500).json({ error: "Failed to fetch last receipt number" });
    }
});

router.get("/account-names", async (req, res) => {
    try {
        const accountGroups = [
            "Income (Indirect)",
            "Income (Direct/Opr.)",
            "CUSTOMERS",
            "Expenses (Direct/Mfg.)",
            "Expenses (Indirect/Admn.)",
            "SUPPLIERS",
        ];

        const query = `
            SELECT account_name, mobile
            FROM account_details
            WHERE account_group IN (?, ?, ?, ?, ?, ?)
        `;
        
        const [results] = await db.execute(query, accountGroups);
        
        // Return both account_name and mobile
        res.json(results);
    } catch (err) {
        console.error("Error fetching account names: ", err);
        res.status(500).send({ error: "Database query error" });
    }
});


module.exports = router;