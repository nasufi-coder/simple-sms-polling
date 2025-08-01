require('dotenv').config();
const express = require('express');
const SimpleDatabase = require('./database');
const SimpleSmsService = require('./smsService');

const app = express();
const port = process.env.PORT || 3002;

// Initialize database
const database = new SimpleDatabase();

// SMS configuration
const smsConfig = {
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  phoneNumber: process.env.TWILIO_PHONE_NUMBER
};

// Initialize SMS service
const smsService = new SimpleSmsService(smsConfig, database);

app.use(express.json());

// Get last SMS message
app.get('/api/last-sms', async (req, res) => {
  try {
    const phoneNumber = smsConfig.phoneNumber;
    const sms = await database.getLastSms(phoneNumber);
    
    if (!sms) {
      return res.json({
        success: true,
        data: null,
        message: 'No SMS messages found'
      });
    }
    
    res.json({
      success: true,
      data: sms
    });
  } catch (error) {
    console.error('Error getting last SMS:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get last SMS'
    });
  }
});

// Get last 2FA code
app.get('/api/last-code', async (req, res) => {
  try {
    const phoneNumber = smsConfig.phoneNumber;
    const code = await database.getLastCode(phoneNumber);
    
    if (!code) {
      return res.json({
        success: true,
        data: null,
        message: 'No codes found'
      });
    }
    
    res.json({
      success: true,
      data: code
    });
  } catch (error) {
    console.error('Error getting last code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get last code'
    });
  }
});

// Get last code from specific sender
app.get('/api/last-code-from/:fromNumber', async (req, res) => {
  try {
    const phoneNumber = smsConfig.phoneNumber;
    const fromNumber = req.params.fromNumber;
    
    // Clean up the phone number format if needed
    const cleanFromNumber = fromNumber.startsWith('+') ? fromNumber : `+${fromNumber}`;
    
    const code = await database.getLastCodeByFromNumber(phoneNumber, cleanFromNumber);
    
    if (!code) {
      return res.json({
        success: true,
        data: null,
        message: 'No codes found from this sender'
      });
    }
    
    res.json({
      success: true,
      data: code
    });
  } catch (error) {
    console.error('Error getting last code from sender:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get last code from sender'
    });
  }
});

// Service status
app.get('/api/status', (req, res) => {
  const status = smsService.getStatus();
  res.json({
    success: true,
    status: 'running',
    sms_service: status,
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Simple SMS Polling Service',
    version: '1.0.0',
    endpoints: [
      'GET /api/last-sms - Get last SMS message',
      'GET /api/last-code - Get last 2FA code',
      'GET /api/last-code-from/:fromNumber - Get last code from specific sender',
      'GET /api/status - Service status'
    ]
  });
});

// Start SMS service
async function startService() {
  try {
    // Validate required environment variables
    if (!smsConfig.accountSid || !smsConfig.authToken || !smsConfig.phoneNumber) {
      throw new Error('Missing required Twilio configuration. Check TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER environment variables.');
    }

    await smsService.connect();
    
    // Run initial cleanup
    await database.cleanupOldSms(7);
    
    // Schedule daily cleanup at 2 AM
    setInterval(async () => {
      try {
        await database.cleanupOldSms(7);
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }, 24 * 60 * 60 * 1000); // 24 hours
    
  } catch (error) {
    console.error('Failed to start SMS service:', error);
    console.error('Make sure your Twilio credentials are configured in the .env file');
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down SMS service...');
  smsService.disconnect();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down SMS service...');
  smsService.disconnect();
  process.exit(0);
});

app.listen(port, () => {
  console.log(`Simple SMS Service running on port ${port}`);
  startService();
});

module.exports = app;