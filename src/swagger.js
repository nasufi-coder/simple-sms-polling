const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SMS Polling Simple API (Proxidize)',
      version: '1.0.0',
      description: 'A lightweight SMS aggregation service that polls Proxidize for incoming messages and extracts 2FA codes automatically. **Send SMS/OTP to: +19147600318**',
      contact: {
        email: 'patrik.nasufi@gmail.com'
      }
    },
    servers: [
      {
        url: process.env.SWAGGER_BASE_URL || 'http://localhost:3001',
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      }
    ],
    components: {
      schemas: {
        SmsMessage: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique message ID'
            },
            phone_number: {
              type: 'string',
              description: 'Your Proxidize modem phone number'
            },
            from_number: {
              type: 'string',
              description: 'Sender phone number'
            },
            body_text: {
              type: 'string',
              description: 'Message content'
            },
            date_sent: {
              type: 'string',
              format: 'date-time',
              description: 'When message was sent'
            },
            message_sid: {
              type: 'string',
              description: 'Proxidize message ID'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'When message was stored'
            }
          }
        },
        Code: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Auto-increment ID'
            },
            code: {
              type: 'string',
              description: 'Extracted verification code'
            },
            body_text: {
              type: 'string',
              description: 'Original message content'
            },
            from_number: {
              type: 'string',
              description: 'Sender phone number'
            },
            used: {
              type: 'boolean',
              description: 'Whether code has been retrieved'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'When code was extracted'
            }
          }
        },
        ServiceStatus: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean'
            },
            status: {
              type: 'string',
              enum: ['running']
            },
            sms_service: {
              type: 'object',
              properties: {
                connected: {
                  type: 'boolean',
                  description: 'Connection status to Proxidize'
                },
                phoneNumber: {
                  type: 'string',
                  description: 'Your Proxidize modem phone number'
                },
                polling: {
                  type: 'boolean',
                  description: 'Whether polling is active'
                },
                lastChecked: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Last time messages were checked'
                }
              }
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean'
            },
            data: {
              oneOf: [
                { $ref: '#/components/schemas/SmsMessage' },
                { $ref: '#/components/schemas/Code' },
                { type: 'null' }
              ]
            },
            message: {
              type: 'string'
            }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'string',
              description: 'Error description'
            }
          }
        }
      }
    }
  },
  apis: ['./src/server.js']
};

const specs = swaggerJsdoc(options);
module.exports = specs;