# Society Maintenance Payment System - React Frontend

A modern, responsive React application for handling society maintenance payments using Razorpay integration.

## 🚀 Features

- **Secure Payment Processing** - Integrated with Razorpay for secure payments
- **Society Management** - Manage multiple societies and flats
- **Payment History** - View and track all payment transactions
- **Receipt Generation** - Generate and print payment receipts
- **Responsive Design** - Works perfectly on desktop and mobile
- **Real-time Validation** - Form validation with instant feedback

## 🛠️ Tech Stack

- **Frontend**: React 19 + Vite
- **Styling**: Custom CSS with modern design
- **Payment**: Razorpay Integration
- **API**: RESTful API communication
- **State Management**: React Hooks

## 📋 Prerequisites

Before running this application, make sure you have:

1. **Node.js** (v16 or higher)
2. **npm** or **yarn**
3. **Razorpay Account** (for payment processing)
4. **Backend Server** running (see backend setup)

## 🔧 Installation & Setup

### 1. Clone and Install Dependencies

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install
```

### 2. Configure Razorpay

1. Sign up for a Razorpay account at [https://razorpay.com](https://razorpay.com)
2. Get your **Key ID** from the dashboard
3. Update the configuration in `src/config/config.js`:

```javascript
RAZORPAY: {
  KEY_ID: 'rzp_test_your_actual_key_id_here', // Replace with your key
  THEME: {
    color: '#667eea'
  },
  CURRENCY: 'INR'
}
```

### 3. Configure Backend API

Update the API base URL in `src/config/config.js`:

```javascript
API_BASE_URL: 'http://localhost:5000', // Your backend server URL
```

### 4. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## 💳 Payment Flow

1. **Form Submission** → User fills maintenance payment details
2. **Order Creation** → Frontend calls backend to create Razorpay order
3. **Payment Gateway** → Razorpay checkout opens
4. **Payment Processing** → User completes payment
5. **Verification** → Backend verifies payment signature
6. **Success Page** → User sees confirmation and receipt

## 🔒 Important Notes

### Razorpay Configuration
- Replace `'rzp_test_your_key_id_here'` in `src/config/config.js` with your actual Razorpay Key ID
- For production, use live keys instead of test keys

### Backend Integration
Make sure your backend server is running with the following endpoints:
- `POST /create-maintenance-order` - Create payment order
- `POST /verify-payment` - Verify payment
- `GET /payment-history` - Get payment history
- `GET /payment-receipt/:order_id` - Get receipt

## 🚀 Production Deployment

### Build for Production

```bash
npm run build
```

### Production Checklist

- [ ] Replace test Razorpay keys with live keys
- [ ] Update API base URL to production server
- [ ] Enable HTTPS for secure payments
- [ ] Test payment flow in production

---

**Happy Coding! 🎉**+ Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
