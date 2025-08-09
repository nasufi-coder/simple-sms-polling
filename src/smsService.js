const { v4: uuidv4 } = require('uuid');

class SimpleSmsService {
  constructor(config, database) {
    this.config = config;
    this.database = database;
    this.isConnected = false;
    this.pollingInterval = null;
    this.pollingFrequency = 30000; // 30 seconds
    this.lastCheckedDate = new Date();
  }

  async connect() {
    try {
      // Test connection by fetching modem info
      const response = await this.makeProxidizeRequest('getinfo');
      
      if (!response.ok) {
        throw new Error(`Connection test failed: ${response.status}`);
      }
      
      console.log(`Connected to Proxidize for ${this.config.phoneNumber}`);
      this.isConnected = true;
      this.startPolling();
      return Promise.resolve();
    } catch (error) {
      console.error('Proxidize connection error:', error);
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
    if (!this.isConnected) {
      console.warn('Cannot fetch messages: not connected');
      return;
    }

    try {
      // Get SMS messages from Proxidize
      const response = await this.makeProxidizeRequest(`sms/get?index=${this.config.modemIndex}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.status}`);
      }

      const data = await response.json();
      const messages = data.sms_messages || [];
      
      // Filter messages to only include those from the last 24 hours  
      const twentyFourHoursAgo = new Date(Date.now() - (24 * 60 * 60 * 1000));
      const recentMessages = messages.filter(message => {
        if (!message.timestamp) return false;
        const messageDate = new Date(message.timestamp * 1000);
        return messageDate >= twentyFourHoursAgo;
      });
      
      // Process messages in reverse order (oldest first)
      const newMessages = recentMessages.reverse();
      
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
      // Convert timestamp to ISO string
      const dateString = message.timestamp 
        ? new Date(message.timestamp * 1000).toISOString()
        : new Date().toISOString();

      const sms = {
        id: uuidv4(),
        phoneNumber: this.config.phoneNumber,
        fromNumber: (message.phone && message.phone[0]) || 'unknown',
        bodyText: message.content || '',
        dateSent: dateString,
        messageSid: String(message.sms_id && message.sms_id[0]) || uuidv4()
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

  async makeProxidizeRequest(endpoint) {
    const url = `${this.config.baseUrl}/api/${endpoint}`;
    
    return fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${this.config.token}`,
        'Content-Type': 'application/json'
      }
    });
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
    console.log('SMS service disconnected');
  }
}

module.exports = SimpleSmsService;