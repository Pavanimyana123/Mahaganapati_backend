const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
// Import route files

const usersRoutes = require('./routes/userRoutes');
const loginRoutes = require('./routes/loginRoutes');
const ratesRoutes = require('./routes/ratesRoutes');
const accountDetailsRoutes = require('./routes/accountDetailsRoutes');
const accountGroupRoutes = require('./routes/accountGroupRoutes');
const companyInfoRoutes = require('./routes/companyInfoRoutes');
const purityRoutes = require('./routes/purityRoutes');
const metalTypeRoutes = require('./routes/metalTypeRoutes');
const designMasterRoutes = require('./routes/designMasterRoutes');
const productRoutes = require('./routes/productRoutes');
const subCategoryRoutes = require('./routes/subCategoryRoutes');
const taxSlabRoutes = require('./routes/taxSlabRoutes');
const urdPurchaseRoutes = require('./routes/urdPurchaseRoutes');
const repairRoutes = require('./routes/repairRoutes');
const repairDetailsRoutes = require('./routes/repairDetailsRoutes');
const estimateRoutes = require('./routes/estimateRoutes');
const updatedValuesRoutes = require('./routes/updatedValuesRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');
const rateCutRoutes = require('./routes/rateCutRoutes');
const openingTagsRoutes = require('./routes/openingTagsRoutes');
const stoneDetailsRoutes = require('./routes/stoneDetailsRoutes');
const saleReturnRoutes = require('./routes/saleReturnRoutes');
const oldItemsRoutes = require('./routes/oldItemsRoutes');
const saleRoutes = require('./routes/saleRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const receiptRoutes = require('./routes/receiptRoutes');
const repairInvoiceRoutes = require('./routes/repairInvoiceRoutes');
const offerRoutes = require('./routes/offerRoutes');


const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

app.use(bodyParser.json({ limit: "50mb" })); // Adjust as needed
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

// Define routes
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use("/invoices", express.static(path.join(__dirname, "uploads/invoices")));

app.use('/', usersRoutes);
app.use('/', loginRoutes);
app.use('/', ratesRoutes);
app.use('/', accountDetailsRoutes);
app.use('/', accountGroupRoutes);
app.use('/', companyInfoRoutes);
app.use('/', purityRoutes);
app.use('/', metalTypeRoutes);
app.use('/', designMasterRoutes);
app.use('/', productRoutes);
app.use('/', subCategoryRoutes);
app.use('/', taxSlabRoutes);
app.use('/', urdPurchaseRoutes);
app.use('/', repairRoutes);
app.use('/', repairDetailsRoutes);
app.use('/', estimateRoutes);
app.use('/', updatedValuesRoutes);
app.use('/', purchaseRoutes);
app.use('/', rateCutRoutes);
app.use('/', openingTagsRoutes);
app.use('/', stoneDetailsRoutes);
app.use('/', saleReturnRoutes);
app.use('/', oldItemsRoutes);
app.use('/', saleRoutes);
app.use('/', invoiceRoutes);
app.use('/', receiptRoutes);
app.use('/', repairInvoiceRoutes);
app.use('/', offerRoutes);


// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
