import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/razorpay-gst', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET
});

// MongoDB Schema for Society Maintenance Payments
const transactionSchema = new mongoose.Schema({
  order_id: { type: String, required: true, unique: true },
  payment_id: String,
  amount: Number, // This will be the maintenance charge amount
  currency: String,
  receipt: String,
  
  // Society maintenance specific fields
  society_name: { type: String, required: true },
  flat_number: { type: String, required: true },
  wing: String,
  floor: String,
  
  // Member details
  member_name: { type: String, required: true },
  member_phone: String,
  member_email: String,
  
  // Maintenance details
  maintenance_type: { 
    type: String, 
    enum: ['monthly', 'quarterly', 'annual'],
    default: 'monthly',
    required: true 
  },
  payment_period: { type: String, required: true }, // e.g., "January 2025", "Q1 2025", "2025"
  due_date: Date,
  
  // Payment details
  status: { type: String, default: 'created', enum: ['created', 'paid', 'failed', 'refunded'] },
  payment_method: String,
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  paidAt: Date,
  
  // Additional notes
  notes: String
});

const Transaction = mongoose.model('Transaction', transactionSchema);

// Validation functions for society maintenance data
const validateSocietyData = {
  // Validate flat number format
  flatNumber: (flatNumber) => {
    if (typeof flatNumber !== 'string' || flatNumber.trim().length === 0) {
      return { valid: false, message: 'Flat number must be a non-empty string' };
    }
    if (flatNumber.length > 10) {
      return { valid: false, message: 'Flat number cannot exceed 10 characters' };
    }
    return { valid: true };
  },

  // Validate society name
  societyName: (societyName) => {
    if (typeof societyName !== 'string' || societyName.trim().length === 0) {
      return { valid: false, message: 'Society name must be a non-empty string' };
    }
    if (societyName.length > 100) {
      return { valid: false, message: 'Society name cannot exceed 100 characters' };
    }
    return { valid: true };
  },

  // Validate member details
  memberName: (memberName) => {
    if (typeof memberName !== 'string' || memberName.trim().length === 0) {
      return { valid: false, message: 'Member name must be a non-empty string' };
    }
    if (memberName.length > 50) {
      return { valid: false, message: 'Member name cannot exceed 50 characters' };
    }
    return { valid: true };
  },

  // Validate phone number
  phoneNumber: (phone) => {
    if (!phone) return { valid: true }; // Optional field
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return { valid: false, message: 'Phone number must be a valid 10-digit Indian mobile number' };
    }
    return { valid: true };
  },

  // Validate email
  email: (email) => {
    if (!email) return { valid: true }; // Optional field
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { valid: false, message: 'Invalid email format' };
    }
    return { valid: true };
  },

  // Validate payment period format
  paymentPeriod: (paymentPeriod, maintenanceType) => {
    if (typeof paymentPeriod !== 'string' || paymentPeriod.trim().length === 0) {
      return { valid: false, message: 'Payment period must be a non-empty string' };
    }

    // Validate format based on maintenance type
    switch (maintenanceType) {
      case 'monthly':
        const monthlyRegex = /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}$/;
        if (!monthlyRegex.test(paymentPeriod)) {
          return { valid: false, message: 'Monthly payment period must be in format "Month YYYY" (e.g., "January 2025")' };
        }
        break;
      case 'quarterly':
        const quarterlyRegex = /^Q[1-4]\s+\d{4}$/;
        if (!quarterlyRegex.test(paymentPeriod)) {
          return { valid: false, message: 'Quarterly payment period must be in format "Q1-Q4 YYYY" (e.g., "Q1 2025")' };
        }
        break;
      case 'annual':
        const annualRegex = /^\d{4}$/;
        if (!annualRegex.test(paymentPeriod)) {
          return { valid: false, message: 'Annual payment period must be in format "YYYY" (e.g., "2025")' };
        }
        break;
    }
    return { valid: true };
  },

  // Validate maintenance amount
  amount: (amount) => {
    if (typeof amount !== 'number' || amount <= 0) {
      return { valid: false, message: 'Amount must be a positive number' };
    }
    if (amount > 999999) {
      return { valid: false, message: 'Amount cannot exceed 999999' };
    }
    return { valid: true };
  },

  // Validate due date
  dueDate: (dueDate) => {
    if (!dueDate) return { valid: true }; // Optional field
    const date = new Date(dueDate);
    if (isNaN(date.getTime())) {
      return { valid: false, message: 'Invalid due date format' };
    }
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    if (date > oneYearFromNow) {
      return { valid: false, message: 'Due date cannot be more than one year in the future' };
    }
    return { valid: true };
  }
};

// Helper function to validate complete maintenance payment data
const validateMaintenancePaymentData = (data) => {
  const errors = [];
  
  // Required field validations
  const flatValidation = validateSocietyData.flatNumber(data.flat_number);
  if (!flatValidation.valid) errors.push(flatValidation.message);
  
  const societyValidation = validateSocietyData.societyName(data.society_name);
  if (!societyValidation.valid) errors.push(societyValidation.message);
  
  const memberValidation = validateSocietyData.memberName(data.member_name);
  if (!memberValidation.valid) errors.push(memberValidation.message);
  
  const periodValidation = validateSocietyData.paymentPeriod(data.payment_period, data.maintenance_type);
  if (!periodValidation.valid) errors.push(periodValidation.message);
  
  const amountValidation = validateSocietyData.amount(data.amount);
  if (!amountValidation.valid) errors.push(amountValidation.message);
  
  // Optional field validations
  const phoneValidation = validateSocietyData.phoneNumber(data.member_phone);
  if (!phoneValidation.valid) errors.push(phoneValidation.message);
  
  const emailValidation = validateSocietyData.email(data.member_email);
  if (!emailValidation.valid) errors.push(emailValidation.message);
  
  const dueDateValidation = validateSocietyData.dueDate(data.due_date);
  if (!dueDateValidation.valid) errors.push(dueDateValidation.message);
  
  return {
    valid: errors.length === 0,
    errors
  };
};

// Routes
// Society Maintenance Payment Order Creation (Simplified)
app.post('/create-maintenance-order', async (req, res) => {
  try {
    const {
      amount,
      currency = 'INR',
      society_name,
      flat_number,
      wing,
      floor,
      member_name,
      member_phone,
      member_email,
      maintenance_type = 'monthly',
      payment_period,
      due_date,
      notes
    } = req.body;

    // Validation for required fields
    if (!amount || !society_name || !flat_number || !member_name || !payment_period) {
      return res.status(400).json({ 
        error: 'Missing required fields: amount, society_name, flat_number, member_name, payment_period' 
      });
    }

    // Validate maintenance_type
    const validMaintenanceTypes = ['monthly', 'quarterly', 'annual'];
    if (!validMaintenanceTypes.includes(maintenance_type)) {
      return res.status(400).json({ 
        error: 'Invalid maintenance_type. Must be one of: ' + validMaintenanceTypes.join(', ') 
      });
    }

    // Comprehensive validation using validation functions
    const validationResult = validateMaintenancePaymentData(req.body);
    if (!validationResult.valid) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: validationResult.errors
      });
    }

    // Generate receipt ID
    const receipt = `${society_name.replace(/\s+/g, '_').toUpperCase()}_${flat_number}_${Date.now()}`;

    const options = {
      amount: amount * 100, // Convert to paise
      currency,
      receipt,
      notes: {
        society_name,
        flat_number,
        member_name,
        maintenance_type,
        payment_period
      }
    };

    const order = await razorpay.orders.create(options);

    // Save to MongoDB
    const transaction = new Transaction({
      order_id: order.id,
      amount, // This is the maintenance charge amount
      currency,
      receipt,
      society_name,
      flat_number,
      wing,
      floor,
      member_name,
      member_phone,
      member_email,
      maintenance_type,
      payment_period,
      due_date: due_date ? new Date(due_date) : null,
      notes
    });

    await transaction.save();

    res.json({
      ...order,
      bill_details: {
        society_name,
        flat_number,
        member_name,
        maintenance_type,
        payment_period,
        maintenance_amount: amount,
        receipt_id: receipt,
        due_date: due_date || null
      }
    });
  } catch (error) {
    console.error('Error creating maintenance order:', error);
    res.status(500).json({ error: 'Failed to create maintenance order' });
  }
});



app.post('/verify-payment', async (req, res) => {
  try {
    const { order_id, payment_id, signature } = req.body;

    if (!order_id || !payment_id || !signature) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const body = order_id + '|' + payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_SECRET)
      .update(body)
      .digest('hex');

    const isValid = expectedSignature === signature;

    if (isValid) {
      // Update transaction status in MongoDB with additional details
      const updateResult = await Transaction.updateOne(
        { order_id },
        { 
          payment_id, 
          status: 'paid',
          paidAt: new Date(),
          payment_method: 'razorpay'
        }
      );

      if (updateResult.matchedCount === 0) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      // Fetch the updated transaction to return maintenance details
      const transaction = await Transaction.findOne({ order_id });
      
      res.json({ 
        verified: isValid,
        transaction_details: {
          society_name: transaction.society_name,
          flat_number: transaction.flat_number,
          member_name: transaction.member_name,
          maintenance_type: transaction.maintenance_type,
          payment_period: transaction.payment_period,
          amount: transaction.amount,
          paid_at: transaction.paidAt,
          receipt_id: transaction.receipt
        }
      });
    } else {
      res.json({ verified: isValid });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// Get payment history for a specific flat or society
app.get('/payment-history', async (req, res) => {
  try {
    const { society_name, flat_number, member_phone, status, maintenance_type, limit = 10, page = 1 } = req.query;

    // Build filter query
    const filter = {};
    if (society_name) filter.society_name = new RegExp(society_name, 'i');
    if (flat_number) filter.flat_number = flat_number;
    if (member_phone) filter.member_phone = member_phone;
    if (status) filter.status = status;
    if (maintenance_type) filter.maintenance_type = maintenance_type;

    const skip = (page - 1) * limit;

    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Transaction.countDocuments(filter);

    res.json({
      transactions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        total_pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

// Get payment receipt details
app.get('/payment-receipt/:order_id', async (req, res) => {
  try {
    const { order_id } = req.params;

    const transaction = await Transaction.findOne({ order_id });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const receipt = {
      receipt_id: transaction.receipt,
      order_id: transaction.order_id,
      payment_id: transaction.payment_id,
      society_details: {
        society_name: transaction.society_name,
        flat_number: transaction.flat_number,
        wing: transaction.wing,
        floor: transaction.floor
      },
      member_details: {
        name: transaction.member_name,
        phone: transaction.member_phone,
        email: transaction.member_email
      },
      payment_details: {
        maintenance_type: transaction.maintenance_type,
        payment_period: transaction.payment_period,
        due_date: transaction.due_date,
        paid_at: transaction.paidAt,
        status: transaction.status,
        payment_method: transaction.payment_method
      },
      maintenance_bill: {
        maintenance_amount: transaction.amount,
        description: `${transaction.maintenance_type} maintenance for ${transaction.payment_period}`
      },
      notes: transaction.notes,
      created_at: transaction.createdAt
    };

    res.json(receipt);
  } catch (error) {
    console.error('Error fetching receipt:', error);
    res.status(500).json({ error: 'Failed to fetch receipt' });
  }
});

// Get pending payments for a society or flat
app.get('/pending-payments', async (req, res) => {
  try {
    const { society_name, flat_number, due_before } = req.query;

    if (!society_name) {
      return res.status(400).json({ error: 'society_name is required' });
    }

    const filter = {
      society_name: new RegExp(society_name, 'i'),
      status: 'created'
    };

    if (flat_number) filter.flat_number = flat_number;
    if (due_before) filter.due_date = { $lt: new Date(due_before) };

    const pendingPayments = await Transaction.find(filter)
      .sort({ due_date: 1, createdAt: -1 });

    res.json({
      pending_payments: pendingPayments,
      count: pendingPayments.length
    });
  } catch (error) {
    console.error('Error fetching pending payments:', error);
    res.status(500).json({ error: 'Failed to fetch pending payments' });
  }
});

// Get society payment summary
app.get('/society-summary/:society_name', async (req, res) => {
  try {
    const { society_name } = req.params;

    const summary = await Transaction.aggregate([
      {
        $match: {
          society_name: new RegExp(society_name, 'i')
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          total_amount: { $sum: '$amount' }
        }
      }
    ]);

    const totalFlats = await Transaction.distinct('flat_number', {
      society_name: new RegExp(society_name, 'i')
    });

    res.json({
      society_name,
      total_flats: totalFlats.length,
      payment_summary: summary,
      flat_numbers: totalFlats.sort()
    });
  } catch (error) {
    console.error('Error fetching society summary:', error);
    res.status(500).json({ error: 'Failed to fetch society summary' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});