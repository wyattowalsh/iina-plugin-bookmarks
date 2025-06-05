// This file will be loaded in the IINA environment where 'iina' global is available
// We use type assertions to avoid build-time import issues

declare global {
  const iina: any;
}

if (typeof iina !== 'undefined') {
  iina.console.log("Plugin is running");
} 