const mongoose = require('mongoose');

const systemSettingSchema = new mongoose.Schema({
  appName: { type: String, default: 'MKS Billing Software' },
  tagline: { type: String, default: 'All-in-One Multi-Tenant POS & GST Invoicing' },
  logoUrl: { type: String, default: '' },
  supportPhone: { type: String, default: '9876543210' },
  supportEmail: { type: String, default: 'support@mksbilling.com' },
  supportWhatsApp: { type: String, default: '9876543210' },
  defaultTrialDays: { type: Number, default: 3 },
  
  // Payment Gateway Config
  razorpayKeyId: { type: String, default: 'rzp_test_TR7vSW6DHXNObT' },
  razorpayKeySecret: { type: String, default: 'PxMC7eeUtgsD4MviXTuGAoic' },
  razorpayWebhookSecret: { type: String, default: '' },
  upiQrVpa: { type: String, default: 'mksbilling@upi' },

  // WhatsApp & SMS Gateway Config
  whatsAppProvider: { type: String, enum: ['DIRECT_WEB', 'META_CLOUD_API', 'ULTRAMSG', 'CUSTOM'], default: 'DIRECT_WEB' },
  whatsAppApiKey: { type: String, default: '' },
  whatsAppPhoneNumberId: { type: String, default: '' },
  whatsAppInstanceId: { type: String, default: '' },
  enableSmsNotifications: { type: Boolean, default: false },

  // Subscription Plans Master Config
  subscriptionPlans: [{
    key: { type: String, required: true },
    name: { type: String, required: true },
    nameHindi: { type: String, required: true },
    price: { type: Number, required: true },
    days: { type: Number, required: true },
    features: [{ type: String }],
    canSendWhatsApp: { type: Boolean, default: false },
    isPopular: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
  }],

  // Platform Maintenance
  maintenanceMode: { type: Boolean, default: false },
  maintenanceMessage: { type: String, default: 'MKS Billing is currently undergoing scheduled maintenance. Please check back shortly.' }
}, { timestamps: true });

module.exports = mongoose.model('SystemSetting', systemSettingSchema);
