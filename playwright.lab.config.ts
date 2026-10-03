import { defineConfig, devices } from '@playwright/test';
export default defineConfig({ testDir:'./tests/lab-e2e', use:{...devices['Desktop Chrome'],baseURL:'http://127.0.0.1:4174'}, webServer:{command:'VITE_SENSOR_LAB_API=http://127.0.0.1:4174 bun run dev:lab -- --host 127.0.0.1 --port 4174',url:'http://127.0.0.1:4174',reuseExistingServer:false,timeout:30000} });
