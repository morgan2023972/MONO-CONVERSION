const fs = require("fs/promises");
const path = require("path");

class ReplayReportWriter {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async write(report) {
    const absolutePath = path.resolve(this.filePath);
    const line = `${JSON.stringify(report)}\n`;
    await fs.appendFile(absolutePath, line, "utf8");
  }
}

module.exports = ReplayReportWriter;
