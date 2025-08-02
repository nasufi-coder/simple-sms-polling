require('dotenv').config();
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./swagger');
const SimpleDatabase = require('./database');
const SimpleSmsService = require('./smsService');

const app = express();
const port = process.env.PORT || 3002;

// Initialize database
const database = new SimpleDatabase();

// SMS configuration
const smsConfig = {
  authId: process.env.PLIVO_AUTH_ID,
  authToken: process.env.PLIVO_AUTH_TOKEN,
  phoneNumber: process.env.PLIVO_PHONE_NUMBER
};

// Initialize SMS service
const smsService = new SimpleSmsService(smsConfig, database);

app.use(express.json());

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'SMS Polling API (Plivo)'
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
 * /:
 *   get:
 *     summary: Redirect to API documentation
 *     description: Redirects to the interactive Swagger API documentation
 *     tags: [Service Info]
 *     responses:
 *       302:
 *         description: Redirect to API documentation
 */
// Root endpoint - redirect to API docs
app.get('/', (req, res) => {
  res.redirect('/api-docs');
});

// Start SMS service
async function startService() {
  try {
    // Validate required environment variables
    if (!smsConfig.authId || !smsConfig.authToken || !smsConfig.phoneNumber) {
      throw new Error('Missing required Plivo configuration. Check PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN, and PLIVO_PHONE_NUMBER environment variables.');
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
    console.error('Make sure your Plivo credentials are configured in the .env file');
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