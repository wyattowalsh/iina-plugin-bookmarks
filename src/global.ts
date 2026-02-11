// Global declarations for IINA environment
declare const iina: any;

// This file needs to be a module, so we export an empty object
export {};

// Global script that runs when the plugin loads
(function() {
  // Only run when in IINA environment
  if (typeof iina !== 'undefined') {
    const { console } = iina;
    console.log("Plugin is running");
  } else {
    console.log("Plugin: Not running in IINA environment");
  }
})(); 