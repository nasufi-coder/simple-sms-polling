const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class SimpleDatabase {
  constructor() {
    const dbDir = './data';
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    this.db = new sqlite3.Database('./data/simple.db', (err) => {
      if (err) {
        console.error('Database error:', err);
      } else {
        console.log('Database connected');
        this.createTables();
      }
    });
  }

  createTables() {
    const createSmsTable = `
      CREATE TABLE IF NOT EXISTS sms_messages (
        id TEXT PRIMARY KEY,
        phone_number TEXT NOT NULL,
        from_number TEXT,
        body_text TEXT,
        date_sent TEXT,
        message_sid TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createCodesTable = `
      CREATE TABLE IF NOT EXISTS sms_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sms_id TEXT NOT NULL,
        code TEXT NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sms_id) REFERENCES sms_messages (id)
      )
    `;

    this.db.exec(createSmsTable);
    this.db.exec(createCodesTable);
  }

  insertSms(sms) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT OR IGNORE INTO sms_messages (id, phone_number, from_number, body_text, date_sent, message_sid) VALUES (?, ?, ?, ?, ?, ?)`;
      
      this.db.run(sql, [sms.id, sms.phoneNumber, sms.fromNumber, sms.bodyText, sms.dateSent, sms.messageSid], function(err) {
        if (err) reject(err);
        else resolve(this.changes > 0);
      });
    });
  }

  insertCode(smsId, code) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO sms_codes (sms_id, code) VALUES (?, ?)`;
      
      this.db.run(sql, [smsId, code], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  getLastSms(phoneNumber) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM sms_messages WHERE phone_number = ? ORDER BY created_at DESC LIMIT 1`;
      
      this.db.get(sql, [phoneNumber], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  getLastCode(phoneNumber) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT c.*, s.body_text, s.from_number 
        FROM sms_codes c 
        JOIN sms_messages s ON c.sms_id = s.id 
        WHERE s.phone_number = ? AND c.used = FALSE
        ORDER BY c.created_at DESC 
        LIMIT 1
      `;
      
      this.db.get(sql, [phoneNumber], (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          this.markCodeAsUsed(row.id);
          resolve(row);
        } else {
          resolve(null);
        }
      });
    });
  }

  getLastCodeByFromNumber(phoneNumber, fromNumber) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT c.*, s.body_text, s.from_number 
        FROM sms_codes c 
        JOIN sms_messages s ON c.sms_id = s.id 
        WHERE s.phone_number = ? AND s.from_number = ? AND c.used = FALSE
        ORDER BY c.created_at DESC 
        LIMIT 1
      `;
      
      this.db.get(sql, [phoneNumber, fromNumber], (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          this.markCodeAsUsed(row.id);
          resolve(row);
        } else {
          resolve(null);
        }
      });
    });
  }

  markCodeAsUsed(codeId) {
    const sql = `UPDATE sms_codes SET used = TRUE WHERE id = ?`;
    this.db.run(sql, [codeId], (err) => {
      if (err) {
        console.error('Error marking code as used:', err);
      }
    });
  }

  cleanupOldSms(olderThanDays = 7) {
    return new Promise((resolve, reject) => {
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
      
      const deleteCodesSQL = `
        DELETE FROM sms_codes 
        WHERE sms_id IN (
          SELECT id FROM sms_messages WHERE created_at < ?
        )
      `;
      
      this.db.run(deleteCodesSQL, [cutoffDate], (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        const deleteSmsSQL = `DELETE FROM sms_messages WHERE created_at < ?`;
        
        this.db.run(deleteSmsSQL, [cutoffDate], function(err) {
          if (err) reject(err);
          else {
            console.log(`Cleaned up ${this.changes} old SMS messages`);
            resolve(this.changes);
          }
        });
      });
    });
  }
}

module.exports = SimpleDatabase;