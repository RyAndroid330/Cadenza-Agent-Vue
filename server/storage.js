// Simple file-based persistence for agent state
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

function getFile(name) {
  return path.join(DATA_DIR, name + '.json');
}

function load(name, fallback = []) {
  try {
    return JSON.parse(fs.readFileSync(getFile(name), 'utf8'));
  } catch {
    return fallback;
  }
}

function save(name, data) {
  fs.writeFileSync(getFile(name), JSON.stringify(data, null, 2));
}

module.exports = { load, save };
