// server.js
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

// MongoDB Schema
const transactionSchema = new mongoose.Schema({
  order_id: { type: String, required: true, unique: true },
  payment_id: String,
  amount: Number,
  currency: String,
  receipt: String,
  gstNumber: String,
  status: { type: String, default: 'created' },
  createdAt: { type: Date, default: Date.now }
});

const Transaction = mongoose.model('Transaction', transactionSchema);

// Routes
app.post('/create-order', async (req, res) => {
  try {
    const { amount, currency, receipt, gstNumber } = req.body;

    if (!amount || !currency || !receipt || !gstNumber) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const options = {
      amount: amount * 100, // Convert to paise
      currency,
      receipt,
      notes: {
        gstNumber
      }
    };

    const order = await razorpay.orders.create(options);

    // Save to MongoDB
    const transaction = new Transaction({
      order_id: order.id,
      amount,
      currency,
      receipt,
      gstNumber
    });

    await transaction.save();

    res.json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

app.post('/verify-payment', (req, res) => {
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
      // Update transaction status in MongoDB
      Transaction.updateOne(
        { order_id },
        { payment_id, status: 'paid' }
      ).exec();
    }

    res.json({ verified: isValid });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});