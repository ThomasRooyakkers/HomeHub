#!/usr/bin/env node
// Usage: node scripts/add-user.js <username>          (prompts for password)
//        node scripts/add-user.js --list
//        node scripts/add-user.js --delete <username>
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const readline = require("readline");

const DATA_DIR = process.env.DATA_DIR || "/data";
const USERS_FILE = path.join(DATA_DIR, "users.json");

const loadUsers = () => {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, "utf8")); } catch { return []; }
};
const saveUsers = (users) => fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

const [,, flag, arg] = process.argv;

if (flag === "--list") {
  const users = loadUsers();
  if (!users.length) { console.log("No users."); process.exit(0); }
  users.forEach(u => console.log(`  ${u.username} (id: ${u.id})`));
  process.exit(0);
}

if (flag === "--delete") {
  if (!arg) { console.error("Usage: node add-user.js --delete <username>"); process.exit(1); }
  const users = loadUsers();
  const filtered = users.filter(u => u.username !== arg);
  if (filtered.length === users.length) { console.error(`User "${arg}" not found.`); process.exit(1); }
  saveUsers(filtered);
  console.log(`User "${arg}" deleted.`);
  process.exit(0);
}

const username = flag;
if (!username) {
  console.error("Usage: node add-user.js <username>");
  console.error("       node add-user.js --list");
  console.error("       node add-user.js --delete <username>");
  process.exit(1);
}

const users = loadUsers();
if (users.find(u => u.username === username)) {
  console.error(`User "${username}" already exists. Use --delete first to replace.`);
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
process.stdout.write("Password: ");
process.stdin.setRawMode(true);

let password = "";
process.stdin.on("data", (ch) => {
  ch = ch.toString();
  if (ch === "\n" || ch === "\r") {
    process.stdin.setRawMode(false);
    rl.close();
    process.stdout.write("\n");
    if (!password) { console.error("Password cannot be empty."); process.exit(1); }
    const passwordHash = bcrypt.hashSync(password, 12);
    users.push({ id: crypto.randomUUID(), username, passwordHash });
    saveUsers(users);
    console.log(`User "${username}" created.`);
  } else if (ch === "") {
    process.exit(1);
  } else if (ch === "") {
    password = password.slice(0, -1);
  } else {
    password += ch;
  }
});
