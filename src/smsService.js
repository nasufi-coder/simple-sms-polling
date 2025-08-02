const plivo = require('plivo');
const { v4: uuidv4 } = require('uuid');

class SimpleSmsService {
  constructor(config, database) {
    this.config = config;
    this.database = database;
    this.client = null;
    this.isConnected = false;
    this.pollingInterval = null;
    this.pollingFrequency = 30000; // 30 seconds
    this.lastCheckedDate = new Date();
  }

  async connect() {
    try {
      this.client = new plivo.Client(this.config.authId, this.config.authToken);
      
      // Test connection by fetching account info
      await this.client.account.get();
      
      console.log(`Connected to Plivo for ${this.config.phoneNumber}`);
      this.isConnected = true;
      this.startPolling();
      return Promise.resolve();
    } catch (error) {
      console.error('Plivo connection error:', error);
      this.isConnected = false;
      return Promise.reject(error);
    }
  }

  startPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    console.log('Starting SMS polling...');
    
    // Poll immediately, then every 30 seconds
    this.fetchNewMessages();
    
    this.pollingInterval = setInterval(() => {
      this.fetchNewMessages();
    }, this.pollingFrequency);
  }

  async fetchNewMessages() {
    if (!this.isConnected || !this.client) {
      console.warn('Cannot fetch messages: not connected');
      return;
    }

    try {
      // Get messages from the last 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const dateFilter = fiveMinutesAgo.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      const response = await this.client.messages.list({
        dst: this.config.phoneNumber,
        message_time__gte: dateFilter,
        limit: 20
      });

      const messages = response.objects || [];
      
      // Process messages in reverse order (oldest first)
      const newMessages = messages.reverse();
      
      for (const message of newMessages) {
        await this.processMessage(message);
      }

      if (newMessages.length > 0) {
        this.lastCheckedDate = new Date();
      }

    } catch (error) {
      console.error('Error fetching messages:', error);
      this.handleConnectionError(error);
    }
  }

  async processMessage(message) {
    try {
      const sms = {
        id: uuidv4(),
        phoneNumber: this.config.phoneNumber,
        fromNumber: message.src,
        bodyText: message.text || '',
        dateSent: message.message_time || new Date().toISOString(),
        messageSid: message.message_uuid
      };

      const inserted = await this.database.insertSms(sms);
      if (inserted) {
        console.log(`New SMS from ${sms.fromNumber}: ${sms.bodyText.substring(0, 50)}...`);
        this.extractCode(sms);
      }
    } catch (error) {
      console.error('Error processing SMS:', error);
    }
  }

  extractCode(sms) {
    const text = sms.bodyText;
    
    // SMS-specific patterns for 2FA codes
    const patterns = [
      /code[:\s]*(\d{4,8})/gi,
      /2fa[:\s]*(\d{4,8})/gi,
      /verification[:\s]*(\d{4,8})/gi,
      /verify[:\s]*(\d{4,8})/gi,
      /pin[:\s]*(\d{4,8})/gi,
      /otp[:\s]*(\d{4,8})/gi,
      /\b(\d{6})\b/g,
      /\b(\d{4})\b/g,
      /\b(\d{5})\b/g
    ];

    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        const code = matches[0].replace(/\D/g, '');
        if (code.length >= 4 && code.length <= 8) {
          this.database.insertCode(sms.id, code);
          console.log(`Code extracted: ${code}`);
          return;
        }
      }
    }
  }

  handleConnectionError(error) {
    console.error('SMS Service error:', error.message);
    
    // For rate limiting or temporary errors, continue polling
    if (error.status === 429) {
      console.log('Rate limited, continuing to poll...');
      return;
    }
    
    // For authentication errors, stop polling
    if (error.status === 401 || error.status === 403) {
      console.error('Authentication failed, stopping polling');
      this.stopPolling();
      this.isConnected = false;
    }
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('SMS polling stopped');
    }
  }

  getStatus() {
    return {
      connected: this.isConnected,
      phoneNumber: this.config.phoneNumber,
      polling: !!this.pollingInterval,
      lastChecked: this.lastCheckedDate.toISOString()
    };
  }

  disconnect() {
    this.stopPolling();
    this.isConnected = false;
    this.client = null;
    console.log('SMS service disconnected');
  }
}

module.exports = SimpleSmsService;