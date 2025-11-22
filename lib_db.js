const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const dbPath = path.join(process.cwd(),'data.sqlite');
const exists = fs.existsSync(dbPath);
const db = new Database(dbPath);
if(!exists){
  db.prepare(`CREATE TABLE registrations (id INTEGER PRIMARY KEY, domain TEXT UNIQUE, subdomain TEXT, fulldomain TEXT, username TEXT, password TEXT, wildcard INTEGER, created INTEGER)`).run();
  db.prepare(`CREATE TABLE certs (id INTEGER PRIMARY KEY, domain TEXT, cert TEXT, key TEXT, issued_at INTEGER, expires_at INTEGER)`).run();
}
module.exports = db;
