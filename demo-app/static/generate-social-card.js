/**
 * Script to generate social media card image
 * Run with: node generate-social-card.js
 * 
 * Requires: npm install puppeteer
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function generateSocialCard() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // Set viewport to match social card dimensions
    await page.setViewport({
        width: 1200,
        height: 630,
        deviceScaleFactor: 2 // For high DPI
    });
    
    // Load the HTML file
    const htmlPath = path.join(__dirname, 'social-card.html');
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });
    
    // Take screenshot
    const outputPath = path.join(__dirname, 'social-card.png');
    await page.screenshot({
        path: outputPath,
        type: 'png',
        fullPage: false
    });
    
    await browser.close();
    console.log(`Social card image generated at: ${outputPath}`);
}

generateSocialCard().catch(console.error);

