# SMS Polling Simple

A lightweight SMS aggregation service that polls Plivo for incoming messages and extracts 2FA codes automatically.

## Features

- **Automatic SMS Polling**: Polls Twilio API every 30 seconds for new messages
- **2FA Code Extraction**: Automatically extracts verification codes using multiple patterns
- **Multi-Sender Support**: Get codes from specific phone numbers
- **SQLite Storage**: Stores messages and codes locally
- **Simple API**: RESTful endpoints for easy integration
- **Auto Cleanup**: Removes old messages (7+ days) automatically

## Prerequisites

- Node.js 16+ 
- Plivo account with:
  - Auth ID
  - Auth Token
  - Phone number (for receiving SMS)

## Quick Start

1. **Configure Environment**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your Plivo credentials:
   ```env
   PLIVO_AUTH_ID=your_auth_id_here
   PLIVO_AUTH_TOKEN=your_auth_token_here  
   PLIVO_PHONE_NUMBER=+1234567890
   PORT=3002
   ```

2. **Run the Service**
   ```bash
   npm start
   # or for development
   npm run dev
   ```

3. **Test the API**
   ```bash
   curl http://localhost:3002/api/status
   ```

## API Endpoints

### `GET /`
Service information and available endpoints

### `GET /api/status`
Returns service status and connection info
```json
{
  "success": true,
  "status": "running",
  "sms_service": {
    "connected": true,
    "phoneNumber": "+1234567890",
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
    "phone_number": "+1234567890",
    "from_number": "+1987654321",
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
    "from_number": "+1987654321",
    "created_at": "2024-01-01T12:00:00.000Z"
  }
}
```

### `GET /api/last-code-from/:fromNumber`
Get the most recent unused code from a specific sender
```bash
curl http://localhost:3002/api/last-code-from/+1987654321
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
EXPOSE 3002
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
| `PLIVO_AUTH_ID` | Your Plivo Auth ID | Yes |
| `PLIVO_AUTH_TOKEN` | Your Plivo Auth Token | Yes |
| `PLIVO_PHONE_NUMBER` | Your Plivo phone number (with +) | Yes |
| `PORT` | Server port (default: 3002) | No |

### Plivo Setup
1. Sign up at [plivo.com](https://plivo.com)
2. Get a phone number from Plivo Console
3. Find your Auth ID and Auth Token in Console
4. Add these to your `.env` file

## Cost Estimation

**Plivo Pricing (US)**:
- Phone number rental: ~$1.00/month
- Incoming SMS: ~$0.0075 per message
- API calls: Free

**Example monthly cost for 100 received 2FA codes**:
- Phone number: $1.00
- SMS reception: $0.75
- **Total: ~$1.75/month**

## Database Schema

### `sms_messages`
- `id` - Unique message ID
- `phone_number` - Your Twilio number
- `from_number` - Sender's number
- `body_text` - Message content
- `date_sent` - When message was sent
- `message_sid` - Twilio message ID

### `sms_codes`
- `id` - Auto-increment ID
- `sms_id` - Reference to SMS message
- `code` - Extracted verification code
- `used` - Whether code has been retrieved
- `created_at` - When code was extracted

## Troubleshooting

### Service Not Starting
```bash
# Check Plivo credentials
curl -u $PLIVO_AUTH_ID:$PLIVO_AUTH_TOKEN \
  https://api.plivo.com/v1/Account/$PLIVO_AUTH_ID/
```

### No Messages Received
- Verify phone number format includes country code (+1234567890)
- Check Plivo Console for incoming message logs
- Ensure SMS are being sent to your Plivo number

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
curl http://localhost:3002/api/status
```

## Security Notes

- Keep Plivo credentials secure and never commit to git
- Use environment variables for all sensitive configuration
- Consider IP whitelisting for production deployments
- Regularly rotate Plivo Auth Tokens

## License

ISC