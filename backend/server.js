import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me';
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_SECRET = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET;

if (!RAZORPAY_KEY_ID || !RAZORPAY_SECRET) {
  console.warn('⚠️ Razorpay credentials are not fully configured. Payment routes will fail until they are set.');
}

const uploadsDir = path.join(__dirname, 'uploads');
const profilesDir = path.join(uploadsDir, 'profiles');
const invoicesDir = path.join(__dirname, 'invoices');
const reportsDir = path.join(__dirname, 'reports');

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

ensureDir(uploadsDir);
ensureDir(profilesDir);
ensureDir(invoicesDir);
ensureDir(reportsDir);

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadsDir));
app.use('/invoices', express.static(invoicesDir));
app.use('/reports', express.static(reportsDir));

// MongoDB setup
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/society-portal';
mongoose
  .connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

const memberSchema = new mongoose.Schema(
  {
    societyName: { type: String, required: true },
    flatNumber: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: String,
    phone: String,
    tenantName: String,
    tenantPhone: String,
    profileImage: String,
    maintenanceAmount: { type: Number, required: true },
    passwordHash: { type: String, required: true },
    isTenantPresent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

const transactionSchema = new mongoose.Schema(
  {
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    orderId: { type: String, required: true, unique: true },
    paymentId: String,
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    receipt: String,
    status: { type: String, enum: ['created', 'paid', 'failed', 'refunded'], default: 'created' },
    paymentMethod: String,
    maintenanceType: { type: String, enum: ['monthly', 'quarterly', 'annual'], default: 'monthly' },
    paymentPeriod: { type: String, required: true },
    notes: String,
    invoicePath: String,
    invoiceGeneratedAt: Date,
    paidAt: Date,
  },
  { timestamps: true }
);

const Member = mongoose.model('Member', memberSchema);
const Admin = mongoose.model('Admin', adminSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);

// Razorpay client
let razorpay = null;
if (RAZORPAY_KEY_ID && RAZORPAY_SECRET) {
  try {
    razorpay = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_SECRET });
  } catch (error) {
    console.error('Failed to initialize Razorpay client:', error);
  }
}

let mailTransporter = null;

const getMailTransporter = () => {
  const host = process.env.SMTP_HOST;
  if (!host) {
    return null;
  }

  if (!mailTransporter) {
    const port = Number(process.env.SMTP_PORT) || 587;
    const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    mailTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  return mailTransporter;
};

const SALT_ROUNDS = 10;

const seedDemoData = async () => {
  try {
    const shouldSeed = process.env.SEED_DEMO_DATA !== 'false';
    if (!shouldSeed) {
      return;
    }

    const adminEmail = process.env.DEMO_ADMIN_EMAIL || 'admin@example.com';
    const adminPassword = process.env.DEMO_ADMIN_PASSWORD || 'Admin@123';

    const existingAdmin = await Admin.findOne({ email: adminEmail });
    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(adminPassword, SALT_ROUNDS);
      await Admin.create({ name: 'Portal Admin', email: adminEmail, passwordHash });
      console.log(`👤 Demo admin ready -> email: ${adminEmail} | password: ${adminPassword}`);
    }

    const memberFlat = process.env.DEMO_MEMBER_FLAT || 'A-101';
    const memberPassword = process.env.DEMO_MEMBER_PASSWORD || 'Member@123';

    const existingMember = await Member.findOne({ flatNumber: memberFlat });
    if (!existingMember) {
      const passwordHash = await bcrypt.hash(memberPassword, SALT_ROUNDS);
      await Member.create({
        societyName: process.env.DEMO_MEMBER_SOCIETY || 'Demo Heights Residency',
        flatNumber: memberFlat,
        name: process.env.DEMO_MEMBER_NAME || 'John Demo',
        email: process.env.DEMO_MEMBER_EMAIL || 'member@example.com',
        phone: process.env.DEMO_MEMBER_PHONE || '9876543210',
        maintenanceAmount: Number(process.env.DEMO_MEMBER_MAINTENANCE || 3500),
        passwordHash,
      });
      console.log(`🏠 Demo member ready -> flat: ${memberFlat} | password: ${memberPassword}`);
    }
  } catch (error) {
    console.error('Demo data seeding failed:', error);
  }
};

seedDemoData();

const createToken = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

const sanitizeMember = (memberDoc) => {
  if (!memberDoc) return null;
  return {
    id: memberDoc._id,
    societyName: memberDoc.societyName,
    flatNumber: memberDoc.flatNumber,
    name: memberDoc.name,
    email: memberDoc.email,
    phone: memberDoc.phone,
    tenantName: memberDoc.tenantName,
    tenantPhone: memberDoc.tenantPhone,
    profileImage: memberDoc.profileImage,
    maintenanceAmount: memberDoc.maintenanceAmount,
    isTenantPresent: memberDoc.isTenantPresent,
    createdAt: memberDoc.createdAt,
    updatedAt: memberDoc.updatedAt,
  };
};

const sanitizeAdmin = (adminDoc) => {
  if (!adminDoc) return null;
  return {
    id: adminDoc._id,
    name: adminDoc.name,
    email: adminDoc.email,
    createdAt: adminDoc.createdAt,
    updatedAt: adminDoc.updatedAt,
  };
};

const authMiddleware = (...roles) => {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization;
      if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization header missing' });
      }

      const token = header.substring(7);
      const payload = jwt.verify(token, JWT_SECRET);

      if (roles.length && !roles.includes(payload.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      if (payload.role === 'member') {
        const member = await Member.findById(payload.id);
        if (!member) {
          return res.status(401).json({ error: 'Member not found' });
        }
        req.member = member;
      }

      if (payload.role === 'admin') {
        const admin = await Admin.findById(payload.id);
        if (!admin) {
          return res.status(401).json({ error: 'Admin not found' });
        }
        req.admin = admin;
      }

      next();
    } catch (error) {
      console.error('Auth error:', error);
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
};

const profileUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      ensureDir(profilesDir);
      cb(null, profilesDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `profile-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
});

const importUpload = multer({ storage: multer.memoryStorage() });

const generateInvoicePdf = (transaction, member) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const fileName = `${transaction.orderId}.pdf`;
      const filePath = path.join(invoicesDir, fileName);
      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      doc
        .fontSize(20)
        .text('Society Maintenance Invoice', { align: 'center' })
        .moveDown();

      doc
        .fontSize(12)
        .text(`Invoice Date: ${new Date().toLocaleDateString()}`)
        .text(`Receipt #: ${transaction.receipt}`)
        .text(`Order ID: ${transaction.orderId}`)
        .moveDown();

      doc.fontSize(14).text('Member Details', { underline: true }).moveDown(0.5);
      doc
        .fontSize(12)
        .text(`Society: ${member.societyName}`)
        .text(`Flat Number: ${member.flatNumber}`)
        .text(`Name: ${member.name}`)
        .text(`Email: ${member.email || '-'}`)
        .text(`Phone: ${member.phone || '-'}`)
        .moveDown();

      doc.fontSize(14).text('Payment Details', { underline: true }).moveDown(0.5);
      doc
        .fontSize(12)
        .text(`Payment Period: ${transaction.paymentPeriod}`)
        .text(`Maintenance Type: ${transaction.maintenanceType}`)
        .text(`Amount Paid: ₹${transaction.amount.toFixed(2)}`)
        .text(`Status: ${transaction.status}`)
        .text(`Paid At: ${transaction.paidAt ? new Date(transaction.paidAt).toLocaleString() : '-'}`)
        .moveDown();

      doc
        .fontSize(12)
        .text('Thank you for keeping your maintenance dues up to date.', { align: 'center' })
        .moveDown();

      doc.end();

      writeStream.on('finish', () => resolve({ filePath, publicUrl: `/invoices/${fileName}` }));
      writeStream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
};

const csvEscape = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
};

const parseDateParam = (value, { endOfDay = false } = {}) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  if (endOfDay) {
    parsed.setHours(23, 59, 59, 999);
  }

  return parsed;
};

const toReportDownloadPath = (fileName) => `/reports/${fileName}`;

const buildPublicUrl = (relativePath) => {
  try {
    const base = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
    return new URL(relativePath, base).href;
  } catch (_error) {
    return relativePath;
  }
};

// Auth Routes
app.post('/auth/member/login', async (req, res) => {
  try {
    const { flatNumber, password } = req.body;
    const member = await Member.findOne({ flatNumber });
    if (!member) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, member.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = createToken({ id: member._id, role: 'member' });
    res.json({ token, member: sanitizeMember(member) });
  } catch (error) {
    console.error('Member login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

app.post('/auth/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = createToken({ id: admin._id, role: 'admin' });
    res.json({ token, admin: sanitizeAdmin(admin) });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

app.post('/auth/admin/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const adminCount = await Admin.countDocuments();
    if (adminCount > 0) {
      try {
        const header = req.headers.authorization;
        if (!header || !header.startsWith('Bearer ')) {
          return res.status(403).json({ error: 'Admin token required' });
        }

        const authToken = header.substring(7);
        const payload = jwt.verify(authToken, JWT_SECRET);
        if (payload.role !== 'admin') {
          return res.status(403).json({ error: 'Admin token required' });
        }

        const admin = await Admin.findById(payload.id);
        if (!admin) {
          return res.status(403).json({ error: 'Admin token invalid' });
        }
      } catch (authError) {
        console.error('Admin register auth error:', authError);
        return res.status(403).json({ error: 'Admin token required' });
      }
    }

    const existing = await Admin.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'Admin with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const admin = await Admin.create({ name, email, passwordHash });
    res.status(201).json({ admin: sanitizeAdmin(admin) });
  } catch (error) {
    console.error('Admin register error:', error);
    res.status(500).json({ error: 'Failed to register admin' });
  }
});

// Member profile routes
app.get('/member/profile', authMiddleware('member'), (req, res) => {
  res.json({ member: sanitizeMember(req.member) });
});

app.put('/member/profile', authMiddleware('member'), profileUpload.single('profileImage'), async (req, res) => {
  try {
    const updatableFields = ['name', 'email', 'phone', 'tenantName', 'tenantPhone', 'isTenantPresent'];
    for (const field of updatableFields) {
      if (field in req.body) {
        if (field === 'isTenantPresent') {
          req.member[field] = req.body[field] === true || req.body[field] === 'true';
        } else {
          req.member[field] = req.body[field];
        }
      }
    }

    if (req.file) {
      req.member.profileImage = `/uploads/profiles/${req.file.filename}`;
    }

    await req.member.save();
    res.json({ member: sanitizeMember(req.member) });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

app.get('/member/maintenance', authMiddleware('member'), (req, res) => {
  res.json({ amount: req.member.maintenanceAmount });
});

// Payment routes (Member)
app.post('/member/payments/create-order', authMiddleware('member'), async (req, res) => {
  try {
    const { paymentPeriod, maintenanceType = 'monthly', amount, notes } = req.body;

    if (!paymentPeriod) {
      return res.status(400).json({ error: 'Payment period is required' });
    }

    const paymentAmount = Number(amount || req.member.maintenanceAmount);
    if (!paymentAmount || paymentAmount <= 0) {
      return res.status(400).json({ error: 'Invalid payment amount' });
    }

    const receipt = `${req.member.societyName.replace(/\s+/g, '-').toUpperCase()}_${req.member.flatNumber}_${Date.now()}`;

    if (!razorpay) {
      const manualOrderId = `manual_${Date.now()}`;
      const manualPaymentId = `manual_pay_${Date.now()}`;

      const transaction = await Transaction.create({
        member: req.member._id,
        orderId: manualOrderId,
        paymentId: manualPaymentId,
        amount: paymentAmount,
        currency: 'INR',
        receipt,
        maintenanceType,
        paymentPeriod,
        notes,
        status: 'paid',
        paymentMethod: 'manual',
        paidAt: new Date(),
      });

      const populatedTransaction = await Transaction.findById(transaction._id).populate('member');
      const invoiceInfo = await generateInvoicePdf(populatedTransaction, populatedTransaction.member);
      populatedTransaction.invoicePath = invoiceInfo.filePath;
      populatedTransaction.invoiceGeneratedAt = new Date();
      await populatedTransaction.save();

      return res.json({
        manual: true,
        order: {
          id: manualOrderId,
          amount: Math.round(paymentAmount * 100),
          currency: 'INR',
          status: 'paid',
        },
        transaction: {
          orderId: populatedTransaction.orderId,
          paymentId: populatedTransaction.paymentId,
          amount: populatedTransaction.amount,
          paymentPeriod: populatedTransaction.paymentPeriod,
          maintenanceType: populatedTransaction.maintenanceType,
          status: populatedTransaction.status,
          paidAt: populatedTransaction.paidAt,
          invoiceUrl: invoiceInfo.publicUrl,
        },
        member: sanitizeMember(req.member),
      });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(paymentAmount * 100),
      currency: 'INR',
      receipt,
      notes: {
        memberId: String(req.member._id),
        flatNumber: req.member.flatNumber,
        paymentPeriod,
      },
    });

    await Transaction.create({
      member: req.member._id,
      orderId: order.id,
      amount: paymentAmount,
      currency: order.currency,
      receipt,
      maintenanceType,
      paymentPeriod,
      notes,
    });

    res.json({
      order,
      member: sanitizeMember(req.member),
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

app.post('/member/payments/verify', async (req, res) => {
  try {
    const { orderId, paymentId, signature } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: 'orderId is required' });
    }

    const existingTransaction = await Transaction.findOne({ orderId }).populate('member');
    if (existingTransaction && existingTransaction.paymentMethod === 'manual') {
      if (!existingTransaction.invoicePath || !existingTransaction.invoiceGeneratedAt) {
        const invoiceInfo = await generateInvoicePdf(existingTransaction, existingTransaction.member);
        existingTransaction.invoicePath = invoiceInfo.filePath;
        existingTransaction.invoiceGeneratedAt = new Date();
        await existingTransaction.save();
      }

      return res.json({
        verified: true,
        invoiceUrl: existingTransaction.invoicePath ? `/invoices/${path.basename(existingTransaction.invoicePath)}` : null,
        transaction: {
          orderId: existingTransaction.orderId,
          paymentId: existingTransaction.paymentId,
          amount: existingTransaction.amount,
          paymentPeriod: existingTransaction.paymentPeriod,
          maintenanceType: existingTransaction.maintenanceType,
          paidAt: existingTransaction.paidAt,
          status: existingTransaction.status,
        },
      });
    }

    if (!paymentId || !signature) {
      return res.status(400).json({ error: 'orderId, paymentId, and signature are required' });
    }

    if (!RAZORPAY_SECRET) {
      return res.status(500).json({ error: 'Razorpay secret not configured' });
    }

    const body = `${orderId}|${paymentId}`;
    const expectedSignature = crypto.createHmac('sha256', RAZORPAY_SECRET).update(body).digest('hex');

    if (expectedSignature !== signature) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    const transaction = await Transaction.findOneAndUpdate(
      { orderId },
      {
        paymentId,
        status: 'paid',
        paymentMethod: 'razorpay',
        paidAt: new Date(),
      },
      { new: true }
    ).populate('member');

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const invoiceInfo = await generateInvoicePdf(transaction, transaction.member);
    transaction.invoicePath = invoiceInfo.filePath;
    transaction.invoiceGeneratedAt = new Date();
    await transaction.save();

    res.json({
      verified: true,
      invoiceUrl: invoiceInfo.publicUrl,
      transaction: {
        orderId: transaction.orderId,
        paymentId: transaction.paymentId,
        amount: transaction.amount,
        paymentPeriod: transaction.paymentPeriod,
        maintenanceType: transaction.maintenanceType,
        paidAt: transaction.paidAt,
        status: transaction.status,
      },
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

app.get('/member/payments', authMiddleware('member'), async (req, res) => {
  try {
    const transactions = await Transaction.find({ member: req.member._id }).sort({ createdAt: -1 });
    res.json({
      payments: transactions.map((txn) => ({
        orderId: txn.orderId,
        paymentId: txn.paymentId,
        amount: txn.amount,
        status: txn.status,
        maintenanceType: txn.maintenanceType,
        paymentPeriod: txn.paymentPeriod,
        paidAt: txn.paidAt,
        invoiceUrl: txn.invoicePath ? `/invoices/${path.basename(txn.invoicePath)}` : null,
        createdAt: txn.createdAt,
      })),
    });
  } catch (error) {
    console.error('Fetch member payments error:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

app.get('/member/payments/:orderId/invoice', authMiddleware('member'), async (req, res) => {
  try {
    const transaction = await Transaction.findOne({ orderId: req.params.orderId, member: req.member._id });
    if (!transaction || !transaction.invoicePath) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.download(transaction.invoicePath);
  } catch (error) {
    console.error('Download invoice error:', error);
    res.status(500).json({ error: 'Failed to download invoice' });
  }
});

// Admin member management
app.get('/admin/members', authMiddleware('admin'), async (req, res) => {
  try {
    const { search } = req.query;
    const filter = {};
    if (search) {
      filter.$or = [
        { flatNumber: new RegExp(search, 'i') },
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { phone: new RegExp(search, 'i') },
      ];
    }

    const members = await Member.find(filter).sort({ createdAt: -1 });
    res.json({ members: members.map(sanitizeMember) });
  } catch (error) {
    console.error('List members error:', error);
    res.status(500).json({ error: 'Failed to list members' });
  }
});

app.post('/admin/members', authMiddleware('admin'), async (req, res) => {
  try {
    const {
      societyName,
      flatNumber,
      name,
      email,
      phone,
      tenantName,
      tenantPhone,
      maintenanceAmount,
      password,
    } = req.body;

    if (!societyName || !flatNumber || !name || !maintenanceAmount || !password) {
      return res.status(400).json({ error: 'societyName, flatNumber, name, maintenanceAmount, password are required' });
    }

    const parsedAmount = Number(maintenanceAmount);
    if (!parsedAmount || parsedAmount <= 0) {
      return res.status(400).json({ error: 'maintenanceAmount must be a positive number' });
    }

    const existing = await Member.findOne({ flatNumber });
    if (existing) {
      return res.status(409).json({ error: 'Member with this flat number already exists' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const member = await Member.create({
      societyName,
      flatNumber,
      name,
      email,
      phone,
      tenantName,
      tenantPhone,
      maintenanceAmount: parsedAmount,
      passwordHash,
      isTenantPresent: Boolean(tenantName),
    });

    res.status(201).json({ member: sanitizeMember(member) });
  } catch (error) {
    console.error('Create member error:', error);
    res.status(500).json({ error: 'Failed to create member' });
  }
});

app.put('/admin/members/:id', authMiddleware('admin'), async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const fields = ['societyName', 'flatNumber', 'name', 'email', 'phone', 'tenantName', 'tenantPhone', 'maintenanceAmount', 'isTenantPresent'];
    for (const field of fields) {
      if (field in req.body) {
        if (field === 'maintenanceAmount') {
          const amt = Number(req.body[field]);
          if (!amt || amt <= 0) {
            return res.status(400).json({ error: 'maintenanceAmount must be a positive number' });
          }
          member[field] = amt;
        } else if (field === 'isTenantPresent') {
          member[field] = req.body[field] === true || req.body[field] === 'true';
        } else {
          member[field] = req.body[field];
        }
      }
    }

    if (req.body.password) {
      member.passwordHash = await bcrypt.hash(req.body.password, SALT_ROUNDS);
    }

    await member.save();
    res.json({ member: sanitizeMember(member) });
  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

app.delete('/admin/members/:id', authMiddleware('admin'), async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    await Transaction.deleteMany({ member: member._id });
    await Member.deleteOne({ _id: member._id });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete member error:', error);
    res.status(500).json({ error: 'Failed to delete member' });
  }
});

app.post('/admin/members/import', authMiddleware('admin'), importUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Import file is required' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    let created = 0;
    let updated = 0;
    const errors = [];

    for (const [index, row] of rows.entries()) {
      try {
        const societyName = row.societyName || row['Society Name'];
        const flatNumber = row.flatNumber || row['Flat Number'];
        const name = row.name || row['Name'];
        const maintenanceAmount = Number(row.maintenanceAmount || row['Maintenance Amount']);
        const password = row.password || row['Password'];

        if (!societyName || !flatNumber || !name || !maintenanceAmount) {
          throw new Error('Missing required fields (societyName, flatNumber, name, maintenanceAmount)');
        }

        const payload = {
          societyName,
          flatNumber,
          name,
          email: row.email || row['Email'] || '',
          phone: row.phone || row['Phone'] || '',
          tenantName: row.tenantName || row['Tenant Name'] || '',
          tenantPhone: row.tenantPhone || row['Tenant Phone'] || '',
          maintenanceAmount,
          isTenantPresent: Boolean(row.tenantName || row['Tenant Name']),
        };

        const existing = await Member.findOne({ flatNumber });
        if (existing) {
          Object.assign(existing, payload);
          if (password) {
            existing.passwordHash = await bcrypt.hash(String(password), SALT_ROUNDS);
          }
          await existing.save();
          updated += 1;
        } else {
          const passwordToUse = password ? String(password) : `Pass@${flatNumber}`;
          const passwordHash = await bcrypt.hash(passwordToUse, SALT_ROUNDS);
          await Member.create({ ...payload, passwordHash });
          created += 1;
        }
      } catch (rowError) {
        errors.push({ row: index + 2, message: rowError.message }); // +2 for header and 1-indexing
      }
    }

    res.json({
      summary: {
        created,
        updated,
        failed: errors.length,
      },
      errors,
    });
  } catch (error) {
    console.error('Import members error:', error);
    res.status(500).json({ error: 'Failed to import members' });
  }
});

// Payment reporting for admin
app.post('/admin/payments/report', authMiddleware('admin'), async (req, res) => {
  try {
    const { startDate, endDate, status, flatNumber, sendEmail = false, email: emailOverride } = req.body || {};

    const filter = {};
    if (status) {
      filter.status = status;
    }

    const start = parseDateParam(startDate);
    const end = parseDateParam(endDate, { endOfDay: true });

    if (start || end) {
      filter.createdAt = {};
      if (start) {
        filter.createdAt.$gte = start;
      }
      if (end) {
        filter.createdAt.$lte = end;
      }
    }

    const memberMatch = {};
    if (flatNumber) {
      memberMatch.flatNumber = flatNumber;
    }

    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .populate({ path: 'member', match: memberMatch });

    const payments = transactions.filter((txn) => txn.member);

    const totalPaid = payments
      .filter((txn) => txn.status === 'paid')
      .reduce((sum, txn) => sum + Number(txn.amount || 0), 0);

    const totalOutstanding = payments
      .filter((txn) => txn.status !== 'paid')
      .reduce((sum, txn) => sum + Number(txn.amount || 0), 0);

    const csvLines = [
      'Society,Flat,Member,Email,Phone,Period,Status,Amount (INR),Paid At,Created At,Updated At',
    ];

    payments.forEach((txn) => {
      csvLines.push(
        [
          csvEscape(txn.member.societyName || ''),
          csvEscape(txn.member.flatNumber || ''),
          csvEscape(txn.member.name || ''),
          csvEscape(txn.member.email || ''),
          csvEscape(txn.member.phone || ''),
          csvEscape(txn.paymentPeriod || ''),
          csvEscape(txn.status || ''),
          csvEscape(Number(txn.amount || 0).toFixed(2)),
          csvEscape(txn.paidAt ? new Date(txn.paidAt).toISOString() : ''),
          csvEscape(txn.createdAt ? new Date(txn.createdAt).toISOString() : ''),
          csvEscape(txn.updatedAt ? new Date(txn.updatedAt).toISOString() : ''),
        ].join(',')
      );
    });

    const csvContent = csvLines.join('\n');
    const fileName = `payment-report-${Date.now()}.csv`;
    const filePath = path.join(reportsDir, fileName);
    await fs.promises.writeFile(filePath, csvContent, 'utf8');

    const downloadPath = toReportDownloadPath(fileName);
    const reportSummary = {
      fileName,
      downloadUrl: downloadPath,
      generatedAt: new Date().toISOString(),
      totals: {
        records: payments.length,
        paid: totalPaid,
        outstanding: totalOutstanding,
      },
      filters: {
        startDate: start ? start.toISOString() : null,
        endDate: end ? end.toISOString() : null,
        status: status || null,
        flatNumber: flatNumber || null,
      },
    };

    const emailStatus = {
      requested: Boolean(sendEmail),
      sent: false,
    };

    if (sendEmail) {
      const transporter = getMailTransporter();
      if (!transporter) {
        emailStatus.error = 'SMTP settings are not configured on the server';
      } else {
        const recipient = emailOverride || req.admin?.email;
        if (!recipient) {
          emailStatus.error = 'Recipient email is missing';
        } else {
          const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@example.com';
          const absoluteUrl = buildPublicUrl(downloadPath);
          const emailLines = [
            `Hello ${req.admin?.name || 'Admin'},`,
            '',
            `Your maintenance payment report has been generated with ${payments.length} record${payments.length === 1 ? '' : 's'}.`,
            `Total collected: \u20B9${totalPaid.toFixed(2)}`,
            `Outstanding: \u20B9${totalOutstanding.toFixed(2)}`,
            '',
            `Download link: ${absoluteUrl}`,
            '',
            'The report CSV file is attached for your convenience.',
            '',
            'Regards,',
            'Society Portal',
          ];

          try {
            await transporter.sendMail({
              to: recipient,
              from: fromAddress,
              subject: 'Maintenance payment report',
              text: emailLines.join('\n'),
              attachments: [
                {
                  filename: fileName,
                  path: filePath,
                },
              ],
            });
            emailStatus.sent = true;
          } catch (mailError) {
            console.error('Payment report email error:', mailError);
            emailStatus.error = mailError.message || 'Failed to send email notification';
          }
        }
      }
    }

    res.json({
      report: reportSummary,
      email: emailStatus,
    });
  } catch (error) {
    console.error('Generate payment report error:', error);
    res.status(500).json({ error: 'Failed to generate payment report' });
  }
});

// Admin payments overview
app.get('/admin/payments', authMiddleware('admin'), async (req, res) => {
  try {
    const { status, flatNumber } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const memberFilter = {};
    if (flatNumber) {
      memberFilter.flatNumber = flatNumber;
    }

    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .populate({ path: 'member', match: memberFilter });

    const filtered = transactions.filter((txn) => txn.member);

    res.json({
      payments: filtered.map((txn) => ({
        orderId: txn.orderId,
        paymentId: txn.paymentId,
        amount: txn.amount,
        status: txn.status,
        paymentPeriod: txn.paymentPeriod,
        maintenanceType: txn.maintenanceType,
        member: sanitizeMember(txn.member),
        invoiceUrl: txn.invoicePath ? `/invoices/${path.basename(txn.invoicePath)}` : null,
        createdAt: txn.createdAt,
        paidAt: txn.paidAt,
      })),
    });
  } catch (error) {
    console.error('List payments error:', error);
    res.status(500).json({ error: 'Failed to list payments' });
  }
});

app.post('/admin/payments/:orderId/notify', authMiddleware('admin'), async (req, res) => {
  try {
    const transporter = getMailTransporter();
    if (!transporter) {
      return res.status(400).json({ error: 'SMTP settings are not configured on the server' });
    }

    const { orderId } = req.params;
    const { email: emailOverride } = req.body || {};

    const transaction = await Transaction.findOne({ orderId }).populate('member');
    if (!transaction) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (!transaction.member) {
      return res.status(400).json({ error: 'Payment is not linked to a member record' });
    }

    if (transaction.status !== 'paid') {
      return res.status(400).json({ error: 'Email notifications are only available for paid transactions' });
    }

    const recipient = emailOverride || transaction.member.email;
    if (!recipient) {
      return res.status(400).json({ error: 'No recipient email address available for this member' });
    }

    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@example.com';
    const invoicePath = transaction.invoicePath;
    const publicInvoicePath = invoicePath ? `/invoices/${path.basename(invoicePath)}` : null;
    const absoluteInvoiceUrl = publicInvoicePath ? buildPublicUrl(publicInvoicePath) : null;

    const amountFormatted = `₹${Number(transaction.amount || 0).toFixed(2)}`;
    const paymentPeriod = transaction.paymentPeriod || 'the latest billing period';

    const lines = [
      `Hello ${transaction.member.name || 'Resident'},`,
      '',
      `We have successfully recorded your maintenance payment for ${paymentPeriod}.`,
      `Amount received: ${amountFormatted}.`,
    ];

    if (transaction.paidAt) {
      lines.push(`Paid on: ${new Date(transaction.paidAt).toLocaleString()}.`);
    }

    if (absoluteInvoiceUrl) {
      lines.push('', `Invoice download link: ${absoluteInvoiceUrl}`);
    }

    lines.push('', 'Thank you for staying up to date with your maintenance dues.', '', 'Regards,', 'Society Portal');

    const mailOptions = {
      to: recipient,
      from: fromAddress,
      subject: 'Maintenance payment confirmation',
      text: lines.join('\n'),
    };

    if (invoicePath && fs.existsSync(invoicePath)) {
      mailOptions.attachments = [
        {
          filename: path.basename(invoicePath),
          path: invoicePath,
        },
      ];
    }

    await transporter.sendMail(mailOptions);

    res.json({
      email: {
        sent: true,
        recipient,
      },
      invoiceUrl: absoluteInvoiceUrl,
    });
  } catch (error) {
    console.error('Send payment notification error:', error);
    res.status(500).json({ error: 'Failed to send payment notification' });
  }
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.originalUrl} not found` });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});