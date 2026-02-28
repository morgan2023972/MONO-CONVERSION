const fs = require("fs/promises");
const path = require("path");

class FileDlqWriter {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async write(entry) {
    const absolutePath = path.resolve(this.filePath);
    const line = `${JSON.stringify(entry)}\n`;
    await fs.appendFile(absolutePath, line, "utf8");
  }
}

module.exports = FileDlqWriter;
