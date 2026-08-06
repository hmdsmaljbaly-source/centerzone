try {
  require('./server.js');
  console.log("Server and all controllers loaded successfully without syntax errors.");
  process.exit(0);
} catch (e) {
  console.error("Syntax or Load Error:", e);
  process.exit(1);
}
