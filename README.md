# SMS Polling Simple

A lightweight SMS aggregation service that polls Proxidize for incoming messages and extracts 2FA codes automatically.

## SMS/OTP Number

**Send your 2FA codes and verification messages to:**
```
+19147600318
```

This number will automatically capture and extract verification codes, making them available via REST API.

## Features

- **Automatic SMS Polling**: Polls Proxidize API every 30 seconds for new messages
- **2FA Code Extraction**: Automatically extracts verification codes using multiple patterns
- **Multi-Sender Support**: Get codes from specific phone numbers
- **SQLite Storage**: Stores messages and codes locally
- **Simple API**: RESTful endpoints for easy integration
- **Interactive Documentation**: Swagger UI for API testing and documentation
- **Auto Cleanup**: Removes old messages (7+ days) automatically

## Prerequisites

- Node.js 16+ 
- Proxidize setup with:
  - API Token
  - Base URL of your Proxidize instance
  - Modem with phone number (for receiving SMS)

## Quick Start

1. **Configure Environment**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your Proxidize credentials:
   ```env
   PROXIDIZE_BASE_URL=http://your-proxidize-instance.com
   PROXIDIZE_TOKEN=your_token_here
   PROXIDIZE_MODEM_INDEX=1
   PROXIDIZE_PHONE_NUMBER=+19147600318
   PORT=3001
   ```

2. **Run the Service**
   ```bash
   npm start
   # or for development
   npm run dev
   ```

3. **Test the API**
   ```bash
   curl http://localhost:3001/api/status
   ```

4. **View API Documentation**
   ```
   http://localhost:3001/api-docs
   ```

5. **Send SMS to Receive OTPs**
   ```
   SMS/OTP Number: +19147600318
   ```
   Send your 2FA codes and verification messages to this number to retrieve them via API.

## API Endpoints

### `GET /`
Redirects to API documentation

### `GET /api/info`
Service information including SMS number for receiving OTPs
```json
{
  "success": true,
  "service": "SMS Polling Service (Proxidize)",
  "sms_number": "+19147600318",
  "instructions": "Send SMS messages to +19147600318 to receive OTP codes via API",
  "endpoints": ["/api/last-sms", "/api/last-code", "/api/status"]
}
```

### `GET /api/status`
Returns service status and connection info
```json
{
  "success": true,
  "status": "running",
  "sms_service": {
    "connected": true,
    "phoneNumber": "+19147600318",
    "polling": true,
    "lastChecked": "2024-01-01T12:00:00.000Z"
  }
}
```

### `GET /api/last-sms`
Get the most recent SMS message
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "phone_number": "+19147600318",
    "from_number": "+19142303149",
    "body_text": "Your verification code is 123456",
    "date_sent": "2024-01-01T12:00:00.000Z"
  }
}
```

### `GET /api/last-code`
Get the most recent unused 2FA code
```json
{
  "success": true,
  "data": {
    "id": 1,
    "code": "123456",
    "body_text": "Your verification code is 123456",
    "from_number": "+19142303149",
    "created_at": "2024-01-01T12:00:00.000Z"
  }
}
```

### `GET /api/last-code-from/:fromNumber`
Get the most recent unused code from a specific sender
```bash
curl http://localhost:3001/api/last-code-from/+19142303149
```

## Code Extraction Patterns

The service automatically detects 2FA codes using these patterns:
- `code: 123456`
- `2fa: 123456`
- `verification: 123456`
- `verify: 123456`
- `pin: 123456`
- `otp: 123456`
- Standalone 4-8 digit numbers

## Deployment

### Railway
1. Connect your GitHub repo to Railway
2. Add environment variables in Railway dashboard
3. Deploy automatically on git push

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

### Manual Server
```bash
# Install PM2 for process management
npm install -g pm2

# Start service
pm2 start src/server.js --name sms-polling

# Save PM2 config
pm2 save
pm2 startup
```

## Configuration

### Environment Variables
| Variable | Description | Required |
|----------|-------------|----------|
| `PROXIDIZE_BASE_URL` | Your Proxidize instance URL | Yes |
| `PROXIDIZE_TOKEN` | Your Proxidize API token | Yes |
| `PROXIDIZE_MODEM_INDEX` | Modem index to use (e.g., 1) | Yes |
| `PROXIDIZE_PHONE_NUMBER` | Your modem's phone number (with +) | Yes |
| `PORT` | Server port (default: 3001) | No |
| `SWAGGER_BASE_URL` | Base URL for Swagger docs (auto-detects if not set) | No |

### Proxidize Setup
1. Set up your Proxidize instance (self-hosted or managed)
2. Connect a modem/phone to your Proxidize setup
3. Get your API token from the Proxidize dashboard
4. Note your modem index (usually starts at 0 or 1)
5. Add these credentials to your `.env` file

## Cost Estimation

**Proxidize Costs**:
- Hardware: One-time cost for modems/phones
- Mobile plan: Varies by carrier (~$10-50/month per modem)
- Data usage: Minimal for SMS polling
- Proxidize software: Check their pricing

**Example monthly cost**:
- Mobile plan: ~$15-30/month
- Data usage: <$1/month for API calls
- **Total: ~$16-31/month per modem**

## Database Schema

### `sms_messages`
- `id` - Unique message ID
- `phone_number` - Your Proxidize modem number
- `from_number` - Sender's number
- `body_text` - Message content
- `date_sent` - When message was sent
- `message_sid` - Proxidize message ID

### `sms_codes`
- `id` - Auto-increment ID
- `sms_id` - Reference to SMS message
- `code` - Extracted verification code
- `used` - Whether code has been retrieved
- `created_at` - When code was extracted

## Troubleshooting

### Service Not Starting
```bash
# Check Proxidize API connection
curl -H "Authorization: Token your_token_here" \
  http://your-proxidize-instance.com/api/getinfo
```

### No Messages Received
- Verify phone number format includes country code (+19147600318)
- Check modem is connected and receiving SMS
- Ensure SMS are being sent to your modem's phone number
- Check modem index is correct (usually 1, not 0)

### Codes Not Extracted
- Check message format matches extraction patterns
- View raw message in `/api/last-sms` endpoint
- Codes must be 4-8 digits

## Development

```bash
# Install dependencies
npm install

# Run in development mode with auto-reload
npm run dev

# Check service status
curl http://localhost:3001/api/status
```

## Security Notes

- Keep Proxidize API token secure and never commit to git
- Use environment variables for all sensitive configuration
- Consider IP whitelisting for production deployments
- Regularly rotate Proxidize API tokens
- Secure your Proxidize instance with proper authentication

## License

ISC