require('dotenv').config();
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./swagger');
const SimpleDatabase = require('./database');
const SimpleSmsService = require('./smsService');

const app = express();
const port = process.env.PORT || 3001;

// Initialize database
const database = new SimpleDatabase();

// SMS configuration
const smsConfig = {
  baseUrl: process.env.PROXIDIZE_BASE_URL || 'http://154.29.79.187',
  token: process.env.PROXIDIZE_TOKEN || '9aa901942439ca27edfdd84c1d46d23d3683443d',
  modemIndex: process.env.PROXIDIZE_MODEM_INDEX || '1',
  phoneNumber: process.env.PROXIDIZE_PHONE_NUMBER || '+19147600318'
};

// Initialize SMS service
const smsService = new SimpleSmsService(smsConfig, database);

app.use(express.json());

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'SMS Polling API (Proxidize)'
}));

/**
 * @swagger
 * /api/last-sms:
 *   get:
 *     summary: Get the most recent SMS message
 *     description: Retrieves the last SMS message received by the service
 *     tags: [SMS Messages]
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             examples:
 *               with_data:
 *                 summary: SMS message found
 *                 value:
 *                   success: true
 *                   data:
 *                     id: "uuid-123"
 *                     phone_number: "+1234567890"
 *                     from_number: "+1987654321"
 *                     body_text: "Your verification code is 123456"
 *                     date_sent: "2024-01-01T12:00:00.000Z"
 *                     message_sid: "uuid-456"
 *               no_data:
 *                 summary: No SMS messages found
 *                 value:
 *                   success: true
 *                   data: null
 *                   message: "No SMS messages found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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

/**
 * @swagger
 * /api/last-code:
 *   get:
 *     summary: Get the most recent unused 2FA code
 *     description: Retrieves the last unused 2FA code and marks it as used
 *     tags: [2FA Codes]
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             examples:
 *               with_code:
 *                 summary: Code found
 *                 value:
 *                   success: true
 *                   data:
 *                     id: 1
 *                     code: "123456"
 *                     body_text: "Your verification code is 123456"
 *                     from_number: "+1987654321"
 *                     created_at: "2024-01-01T12:00:00.000Z"
 *               no_code:
 *                 summary: No codes found
 *                 value:
 *                   success: true
 *                   data: null
 *                   message: "No codes found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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

/**
 * @swagger
 * /api/last-code-from/{fromNumber}:
 *   get:
 *     summary: Get the most recent unused code from specific sender
 *     description: Retrieves the last unused 2FA code from a specific phone number and marks it as used
 *     tags: [2FA Codes]
 *     parameters:
 *       - in: path
 *         name: fromNumber
 *         required: true
 *         schema:
 *           type: string
 *         description: Phone number of the sender (with or without + prefix)
 *         example: "+1987654321"
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             examples:
 *               with_code:
 *                 summary: Code found from sender
 *                 value:
 *                   success: true
 *                   data:
 *                     id: 1
 *                     code: "123456"
 *                     body_text: "Your verification code is 123456"
 *                     from_number: "+1987654321"
 *                     created_at: "2024-01-01T12:00:00.000Z"
 *               no_code:
 *                 summary: No codes found from this sender
 *                 value:
 *                   success: true
 *                   data: null
 *                   message: "No codes found from this sender"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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

/**
 * @swagger
 * /api/status:
 *   get:
 *     summary: Get service status
 *     description: Returns the current status of the SMS polling service
 *     tags: [Service Status]
 *     responses:
 *       200:
 *         description: Service status information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServiceStatus'
 *             example:
 *               success: true
 *               status: "running"
 *               sms_service:
 *                 connected: true
 *                 phoneNumber: "+1234567890"
 *                 polling: true
 *                 lastChecked: "2024-01-01T12:00:00.000Z"
 *               timestamp: "2024-01-01T12:00:00.000Z"
 */
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

/**
 * @swagger
 * /api/info:
 *   get:
 *     summary: Get service information
 *     description: Returns information about the SMS service including the phone number to send OTPs to
 *     tags: [Service Info]
 *     responses:
 *       200:
 *         description: Service information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 service:
 *                   type: string
 *                   example: "SMS Polling Service (Proxidize)"
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 sms_number:
 *                   type: string
 *                   example: "+19147600318"
 *                   description: "Send your SMS/OTP codes to this number"
 *                 instructions:
 *                   type: string
 *                   example: "Send SMS messages to +19147600318 to receive OTP codes via API"
 *                 endpoints:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["/api/last-sms", "/api/last-code", "/api/status"]
 */

/**
 * @swagger
 * /:
 *   get:
 *     summary: Redirect to API documentation
 *     description: Redirects to the interactive Swagger API documentation
 *     tags: [Service Info]
 *     responses:
 *       302:
 *         description: Redirect to API documentation
 */
// Service info endpoint
app.get('/api/info', (req, res) => {
  res.json({
    success: true,
    service: 'SMS Polling Service (Proxidize)',
    version: '1.0.0',
    sms_number: smsConfig.phoneNumber,
    instructions: `Send SMS messages to ${smsConfig.phoneNumber} to receive OTP codes via API`,
    endpoints: [
      '/api/last-sms',
      '/api/last-code', 
      '/api/last-code-from/:fromNumber',
      '/api/status',
      '/api/info'
    ],
    documentation: '/api-docs'
  });
});

// Root endpoint - redirect to API docs
app.get('/', (req, res) => {
  res.redirect('/api-docs');
});

// Start SMS service
async function startService() {
  try {
    // Validate required environment variables
    if (!smsConfig.baseUrl || !smsConfig.token || !smsConfig.phoneNumber) {
      throw new Error('Missing required Proxidize configuration. Check PROXIDIZE_BASE_URL, PROXIDIZE_TOKEN, and PROXIDIZE_PHONE_NUMBER environment variables.');
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
    console.error('Make sure your Proxidize credentials are configured in the .env file');
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