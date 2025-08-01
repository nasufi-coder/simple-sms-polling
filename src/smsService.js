const twilio = require('twilio');
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
      this.client = twilio(this.config.accountSid, this.config.authToken);
      
      // Test connection by fetching account info
      await this.client.api.accounts(this.config.accountSid).fetch();
      
      console.log(`Connected to Twilio for ${this.config.phoneNumber}`);
      this.isConnected = true;
      this.startPolling();
      return Promise.resolve();
    } catch (error) {
      console.error('Twilio connection error:', error);
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
      const messages = await this.client.messages.list({
        to: this.config.phoneNumber,
        dateSent: this.getDateFilter()
      });

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

  getDateFilter() {
    // Get messages from the last 5 minutes to avoid missing any
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return fiveMinutesAgo;
  }

  async processMessage(message) {
    try {
      const sms = {
        id: uuidv4(),
        phoneNumber: this.config.phoneNumber,
        fromNumber: message.from,
        bodyText: message.body || '',
        dateSent: message.dateSent?.toISOString() || new Date().toISOString(),
        messageSid: message.sid
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
    if (error.code === 429 || error.status === 429) {
      console.log('Rate limited, continuing to poll...');
      return;
    }
    
    // For authentication errors, stop polling
    if (error.code === 20003 || error.status === 401) {
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