// Global declarations for IINA environment
declare global {
  const iina: any;
}

// Only run when in IINA environment
if (typeof iina !== 'undefined') {
  const { console } = iina;
  console.log("Plugin is running");
} else {
  console.log("Plugin: Not running in IINA environment");
} 