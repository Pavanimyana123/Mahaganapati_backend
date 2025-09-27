const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
// Import route files

const purityRoutes = require('./routes/purityRoutes');
const productRoutes = require('./routes/productRoutes');
const metalTypeRoutes = require('./routes/metalTypeRoutes');
const designMasterRoutes = require('./routes/designMasterRoutes');
const accountRoutes = require('./routes/accountRoutes');
const accountGroupRoutes = require('./routes/accountGroup');
const receiptRoutes = require('./routes/receiptRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const repairRoutes = require('./routes/repairRoutes');
const accountDetailsRoutes = require('./routes/accountdetailsRoutes');
const receiptAccountNameRoutes = require("./routes/receiptaccountname/receiptaccountnameroute");
const paymentAccountNameRoutes = require("./routes/paymentaccountname/paymentaccountnameroute");
const estimateRoutes = require("./routes/estimateRoutes");
const openingTagsRoutes = require('./routes/openingTagsRoutes');
const salesRoutes = require("./routes/sales/salesroute");
const taxSlabRoutes = require('./routes/taxSlabRoutes');
const stoneDetailsRoutes = require('./routes/stoneDetailsRoutes');
const ratesRoutes = require('./routes/ratesRoute');
const invoiceRoutes = require("./routes/sales/invoiceroute");
const urdRoutes = require("./routes/urdRoutes");
const purchaseRoutes = require('./routes/purchaseRoutes');
const purchasesRoutes = require('./routes/purchasesRoutes');
const companyInfoRoutes = require('./routes/companyInfoRoutes');
const updateValuesRoutes = require('./routes/updateValuesRoutes');
const authRoutes = require('./routes/userRoutes');
const assigningorderRoutes = require('./routes/sales/accountRoutes');
const receiptNumberRoutes = require("./routes/receiptaccountname/receiptroute");
const paymentNumberRoutes = require("./routes/paymentaccountname/paymentroute");
const oldItemsRoutes = require('./routes/oldItemsRoutes');
const memberSchemeRoutes = require('./routes/memberSchemeRoutes');
const saleReturnRoutes = require('./routes/saleReturnRoute');
const repairDetailsRoutes = require('./routes/repairDetailsRoute');
const UsersRoutes = require('./routes/UsersRoute');
const SubCategoryRoutes = require('./routes/SubCategoryRoutes');
const ordersRoutes = require('./routes/sales/ordersroute')
const rateCutsRoutes = require("./routes/rateCutsRoutes");
const purchasePaymentRoutes = require("./routes/purchasePaymentRoutes");
const offerRoutes = require("./routes/OffersRoutes");
const repairInvoiceRoutes = require("./routes/repairInvoiceRoute");

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: "50mb" })); // Adjust as needed
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

// Define routes
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use("/invoices", express.static(path.join(__dirname, "uploads/invoices")));

app.use('/', memberSchemeRoutes);
app.use('/', oldItemsRoutes);
app.use('/', updateValuesRoutes);
app.use('/', purityRoutes);
app.use('/', productRoutes);
app.use('/', metalTypeRoutes);
app.use('/', designMasterRoutes);
app.use('/', accountRoutes);
app.use('/', accountGroupRoutes);
app.use('/', receiptRoutes);
app.use('/', paymentRoutes);
app.use('/', repairRoutes);
app.use('/', repairDetailsRoutes);
app.use('/', accountDetailsRoutes);
app.use("/", receiptAccountNameRoutes);
app.use("/", paymentAccountNameRoutes);
app.use('/', estimateRoutes);
app.use("/", openingTagsRoutes);
app.use("/", salesRoutes);
app.use("/", taxSlabRoutes);
app.use("/", stoneDetailsRoutes);
app.use('/', ratesRoutes);
app.use("/", invoiceRoutes);
app.use('/', urdRoutes);
app.use('/', purchaseRoutes);
app.use('/', purchasesRoutes);
app.use('/', companyInfoRoutes);
app.use('/', authRoutes);
app.use('/', assigningorderRoutes); 
app.use('/', receiptNumberRoutes); 
app.use('/', paymentNumberRoutes);
app.use('/', saleReturnRoutes);
app.use('/', UsersRoutes);
app.use('/', SubCategoryRoutes);
app.use("/", ordersRoutes);
app.use("/", rateCutsRoutes);
app.use("/", purchasePaymentRoutes);
app.use('/api', offerRoutes);
app.use('/', repairInvoiceRoutes);

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
