// server.js
require("dotenv").config();
console.log("Loaded RAPID_API_KEY:", process.env.RAPID_API_KEY ? "✅ Found" : "❌ Missing");
console.log("Loaded OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "✅ Found" : "❌ Missing");

const express = require("express");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const OpenAI = require("openai");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors()); // allow cross-origin requests (important for React Native)
app.use(express.json());

// Initialize Firebase Admin (optional - only if service account is provided)
let db = null;
try {
  const serviceAccount = require("./auri-76581-firebase-adminsdk-fbsvc-1122c9b7d7.json"); // 👈 path to your JSON

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  db = admin.firestore();
  console.log("✅ Firebase Admin initialized with service account");
} catch (error) {
  console.warn("⚠️ Firebase Admin initialization failed:", error.message);
  console.warn("⚠️ Backend will not talk directly to Firestore. Frontend should send snapshots.");
}

// Initialize OpenAI
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

// Small helper to read a file as base64
function fileToBase64(filePath) {
  const data = fs.readFileSync(filePath);
  return data.toString("base64");
}

// =============== ENVIRONMENT VARIABLES ===============
const RAPID_API_KEY = process.env.RAPID_API_KEY;
const ASSEMBLYAI_KEY = process.env.ASSEMBLYAI_KEY;
const BASE_URL = "https://api.assemblyai.com/v2";
const isDevEnv = process.env.NODE_ENV !== "production";

// ⚠ SECURITY WARNING:
// We currently trust `userId` coming from the client (query/body) for Firestore reads.
// This is NOT safe for production.
// Before going live, replace this with Firebase Auth middleware that:
// - validates a Firebase ID token from headers,
// - decodes it,
// - sets req.userUid = decoded.uid,
// - and uses that uid inside buildMonthlySnapshotFromFirestore instead of trusting client-provided userId.

if (!RAPID_API_KEY) {
  console.error("❌ Missing RAPID_API_KEY in .env file");
}
if (!ASSEMBLYAI_KEY) {
  console.warn("⚠️ Missing ASSEMBLYAI_KEY (transcription may not work)");
}

// ======================================================
// 📧 Email Verification Setup (Nodemailer)
// ======================================================
// Initialize Nodemailer transporter
// For testing: Using Ethereal Email (fake SMTP for testing)
// For production: Configure real SMTP in .env file:
// EMAIL_HOST=smtp.gmail.com (or your SMTP server)
// EMAIL_PORT=587
// EMAIL_USER=your-email@gmail.com
// EMAIL_PASS=your-app-password (for Gmail, use App Password, not regular password)
// EMAIL_FROM=your-email@gmail.com
// USE_TEST_EMAIL=false

let transporter = null;
let transporterInitialized = false;
const USE_TEST_EMAIL = process.env.USE_TEST_EMAIL !== "false"; // Default to true for testing
const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || "587");
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
let EMAIL_FROM = process.env.EMAIL_FROM || EMAIL_USER || "noreply@auri.app";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:8081";

// In-memory store for OTP codes (in production, use Redis or database)
const otpStore = new Map(); // userId -> { code, expiresAt, email, createdAt }

// Initialize transporter
(async () => {
  try {
    if (USE_TEST_EMAIL && !EMAIL_USER && !EMAIL_PASS) {
      // Create a new test account dynamically
      console.log("🔧 Creating Ethereal Email test account...");
      const testAccount = await nodemailer.createTestAccount();
      
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });

      EMAIL_FROM = testAccount.user; // Set from address to test account email
      transporterInitialized = true;

      console.log("✅ Email server ready (TEST MODE - using Ethereal Email)");
      console.log("   📧 View sent emails at: https://ethereal.email");
      console.log("   📧 Test account created:");
      console.log("      User: " + testAccount.user);
      console.log("      Pass: " + testAccount.pass);
    } else if (EMAIL_USER && EMAIL_PASS) {
      // Use provided credentials (test or production)
      transporter = nodemailer.createTransport({
        host: EMAIL_HOST || (USE_TEST_EMAIL ? "smtp.ethereal.email" : "smtp.gmail.com"),
        port: EMAIL_PORT,
        secure: EMAIL_PORT === 465,
        auth: {
          user: EMAIL_USER,
          pass: EMAIL_PASS,
        },
      });

      // Verify connection
      try {
        await transporter.verify();
        EMAIL_FROM = EMAIL_FROM || EMAIL_USER; // Ensure EMAIL_FROM is set
        transporterInitialized = true;
        
        if (USE_TEST_EMAIL) {
          console.log("✅ Email server ready (TEST MODE - using Ethereal Email)");
          console.log("   📧 View sent emails at: https://ethereal.email");
          console.log("   📧 Test account: " + EMAIL_USER);
        } else {
          console.log("✅ Email server is ready to send messages (PRODUCTION MODE)");
        }
      } catch (verifyError) {
        // If verification fails and we're in test mode, try to create a new test account
        if (USE_TEST_EMAIL) {
          console.warn("⚠️ Provided test account credentials failed. Creating new test account...");
          const testAccount = await nodemailer.createTestAccount();
          
          transporter = nodemailer.createTransport({
            host: "smtp.ethereal.email",
            port: 587,
            secure: false,
            auth: {
              user: testAccount.user,
              pass: testAccount.pass,
            },
          });
          
          EMAIL_FROM = testAccount.user; // Set from address to test account email
          transporterInitialized = true;
          
          console.log("✅ Email server ready (TEST MODE - using auto-generated Ethereal Email account)");
          console.log("   📧 View sent emails at: https://ethereal.email");
          console.log("   📧 New test account:");
          console.log("      User: " + testAccount.user);
          console.log("      Pass: " + testAccount.pass);
        } else {
          throw verifyError; // Re-throw if production mode
        }
      }
    } else {
      console.warn("⚠️ Email credentials not configured. Email verification will not work.");
      console.warn("   For testing: Leave EMAIL_USER and EMAIL_PASS unset to auto-create test account");
      console.warn("   For production: Set EMAIL_USER and EMAIL_PASS in .env file");
    }
  } catch (error) {
    console.error("❌ Email transporter initialization failed:", error.message);
    if (USE_TEST_EMAIL && EMAIL_USER) {
      console.error("   The provided test account credentials may be expired.");
      console.error("   Remove EMAIL_USER and EMAIL_PASS from .env to auto-create a new test account.");
    } else {
      console.error("   Make sure EMAIL_USER and EMAIL_PASS are set correctly in .env");
    }
  }
})();

/**
 * Generate a 6-digit OTP code
 */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
}

/**
 * Send OTP code via email
 */
async function sendOTPEmail(email, userId, username) {
  // Ensure transporter is initialized
  if (!transporter || !transporterInitialized) {
    // Try to initialize if not already done
    try {
      if (USE_TEST_EMAIL && !EMAIL_USER && !EMAIL_PASS) {
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
          host: "smtp.ethereal.email",
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        EMAIL_FROM = testAccount.user;
        transporterInitialized = true;
        console.log("✅ Email transporter initialized with auto-generated test account");
      } else {
        throw new Error("Email transporter not configured. Please set EMAIL_USER and EMAIL_PASS in .env");
      }
    } catch (initError) {
      throw new Error("Email transporter not configured: " + initError.message);
    }
  }

  // Generate 6-digit OTP
  const otpCode = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store OTP (in production, save to database)
  otpStore.set(userId, {
    code: otpCode,
    email,
    expiresAt,
    createdAt: new Date(),
    attempts: 0, // Track verification attempts
  });

  // Ensure EMAIL_FROM is set
  const fromAddress = EMAIL_FROM || "noreply@auri.app";
  if (!fromAddress) {
    throw new Error("EMAIL_FROM is not configured");
  }

  // Email content with OTP
  const mailOptions = {
    from: USE_TEST_EMAIL 
      ? `"Auri App (Test)" <${fromAddress}>`
      : `"Auri App" <${fromAddress}>`,
    to: email,
    subject: "Your verification code" + (USE_TEST_EMAIL ? " (TEST)" : ""),
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #1E5449, #154C42); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .otp-box { background: #1E3932; color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; border-radius: 10px; letter-spacing: 8px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Auri! 👋</h1>
            </div>
            <div class="content">
              <h2>Hi ${username || "there"},</h2>
              <p>Thank you for signing up! Use the verification code below to complete your registration:</p>
              <div class="otp-box">${otpCode}</div>
              <p><strong>This code will expire in 10 minutes.</strong></p>
              <p>If you didn't create an account, you can safely ignore this email.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Auri. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      Welcome to Auri!
      
      Hi ${username || "there"},
      
      Thank you for signing up! Use the verification code below to complete your registration:
      
      ${otpCode}
      
      This code will expire in 10 minutes.
      
      If you didn't create an account, you can safely ignore this email.
      
      © ${new Date().getFullYear()} Auri. All rights reserved.
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ OTP email sent:", info.messageId);
    console.log("   OTP code for", email, ":", otpCode); // Log OTP for testing (remove in production)
    
    // If using test email, log the preview URL
    if (USE_TEST_EMAIL && info.messageId) {
      const previewURL = nodemailer.getTestMessageUrl(info);
      if (previewURL) {
        console.log("🔗 Preview email at:", previewURL);
      }
    }
    
    return { success: true, otpCode: USE_TEST_EMAIL ? otpCode : undefined, previewURL: USE_TEST_EMAIL && info.messageId ? nodemailer.getTestMessageUrl(info) : null };
  } catch (error) {
    console.error("❌ Error sending OTP email:", error);
    throw error;
  }
}


// ======================================================
// 🧾 Receipt OCR via OpenAI Vision
// ======================================================
app.post("/ocr/receipt", upload.single("file"), async (req, res) => {
  try {
    if (!openai) {
      return res.status(500).json({ error: "OpenAI API key not configured" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Missing receipt image file" });
    }

    const filePath = req.file.path;
    const base64Image = fileToBase64(filePath);

    const systemPrompt = `
You are a receipt OCR and parser. You will be given an image of a shopping or payment receipt.
Extract the key structured data and return it as strict JSON with this shape:
{
  "receipts": [
    {
      "total": number | null,          // final amount customer pays (includes tax & service)
      "totalInclTax": number | null,   // alias for total, may be same as total
      "sub_total": number | null,      // items total BEFORE any tax/service (sum of line items)
      "service_charge": number | null, // total service charge on the bill
      "tax": number | null,            // total SST/GST/VAT or similar tax
      "date": string | null,          // CRITICAL: Extract the receipt date in any format (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, or text like "Dec 17, 2025"). If no date is visible, return null.
      "ocr_text": string,
      "merchant_name": string | null,
      "payment_method": string | null,
      "items": [
        {
          "description": string,
          "quantity": number | null,    // CRITICAL: Extract the quantity for each item. If receipt shows "2x Bread" or "Bread x2" or "Bread 2", set quantity to 2. If no quantity shown, set to 1 (not null).
          "unit_price": number | null,
          "amount": number | null      // line total = quantity * unit_price
        }
      ]
    }
  ]
}

VERY IMPORTANT RULES ABOUT TOTAL (CRITICAL):
- Always set "total" to the FINAL amount the customer must pay, INCLUDING all SST/tax, service charges, and fees.
- Look for the line that says "Total", "Grand Total", "Net Total", "Amount Due", or "Payable" - this is usually at the bottom of the receipt.
- If the receipt shows both "SubTotal" and "Net Total" / "Grand Total" / "Total", choose the LAST/BOTTOM one that includes taxes and service.
- If you see lines like "Service Charge", "SST", "GST", "Tax", "Service", make sure they are INCLUDED in the "total" value.
- Double-check: total should equal sub_total + service_charge + tax (if all are present).
- Only use a subtotal (before tax) when no final total including tax appears anywhere.
- Be very careful with decimal places and currency symbols (RM, $, etc.) - extract the exact numeric value.

TAX BREAKDOWN RULES:
- If the receipt has a clear items subtotal (before tax), put that number in "sub_total".
- If the receipt has a line like "Service Charge" or "Service", put the numeric amount into "service_charge".
- If the receipt has a line like "SST", "GST", "Tax", put the numeric amount into "tax".
- If you cannot find a value for any of these (sub_total, service_charge, tax), set them to null.
- Do NOT try to infer hidden taxes; only use amounts explicitly written on the receipt.
- Verify: sub_total + service_charge + tax should approximately equal total (allow for rounding differences).

DATE EXTRACTION RULES (CRITICAL):
- Look for date fields like "Date:", "Transaction Date:", "Issued:", "Printed:", "Date/Time:", or dates near the top/bottom of receipt
- Common formats: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, or text like "14 Dec 2023", "Dec 14, 2023", "December 14, 2023", "14/12/2023"
- Look for timestamps too - they often contain dates: "Dec 14, 2023 9:18 AM" should extract "14 Dec 2023" or "Dec 14, 2023"
- If you see a date anywhere on the receipt (even in a timestamp), extract it. Only return null if absolutely no date is visible.
- Preserve the original format as a string (don't convert to ISO unless it's already ISO)
- Be careful with year - if you see "2023" extract it as "2023", not "2025"

QUANTITY EXTRACTION RULES (CRITICAL):
- For each item, look for quantity indicators: "2x", "x2", "2 pcs", "Qty: 2", or numbers before/after item names
- If an item shows "2 Bread" or "Bread 2" or "2x Bread" or "Bread x2", set quantity to 2
- If the SAME item appears multiple times on separate lines (e.g., "M1 Hot RM3.70" appears twice), combine them into ONE item with quantity = number of occurrences
- If no quantity is shown for an item, set quantity to 1 (NOT null)
- The amount field should be the total line amount (quantity * unit_price)
- If an item line shows "1x Item RM10.00", then quantity=1, unit_price=10.00, amount=10.00
- If an item line shows "2x Item RM20.00", then quantity=2, unit_price=10.00, amount=20.00

ITEM EXTRACTION RULES (CRITICAL):
- Extract each distinct item as a separate entry in the items array
- If you see modifiers or add-ons (like "- Soup" or "- Take Away"), decide if they should be:
  a) Separate items (if they have their own price)
  b) Part of the parent item description (if they're just modifiers without separate pricing)
- Group related items together when they appear to be part of the same order line
- Be careful not to duplicate items that appear multiple times - combine them with correct quantity instead

CALCULATION VERIFICATION:
- For each item: verify that amount = quantity * unit_price (or very close, allowing for rounding)
- For the receipt: verify that sub_total + service_charge + tax ≈ total (allowing for rounding)
- If calculations don't match, re-check your extraction - you may have misread a number

General rules:
- If you are unsure about any numeric field, set it to null instead of guessing.
- Always include at least one object in "receipts".
- Always include "ocr_text" with all text you can reasonably read.
- Double-check all numbers for accuracy - OCR can misread digits (0 vs O, 1 vs I, 5 vs S, etc.)
- ONLY output valid JSON, no extra commentary.`;

    let parsed;
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Here is the receipt image. Extract the data as specified.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${req.file.mimetype || "image/jpeg"};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        temperature: 0,
        max_tokens: 700,
      });

      const raw = response.choices[0]?.message?.content || "{}";
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error("❌ OpenAI OCR error:", err.response?.data || err.message || err);
      return res.status(500).json({ error: "Failed to process receipt with OpenAI" });
    } finally {
      // clean up temp file
      fs.unlink(filePath, () => {});
    }

    // Normalise shape a bit to keep frontend logic simple
    if (!parsed.receipts || !Array.isArray(parsed.receipts) || parsed.receipts.length === 0) {
      parsed.receipts = [
        {
          total: null,
          totalInclTax: null,
          date: null,
          ocr_text: "",
          merchant_name: null,
          payment_method: null,
          items: [],
        },
      ];
    }

    return res.json(parsed);
  } catch (err) {
    console.error("❌ /ocr/receipt error:", err.response?.data || err.message || err);
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, () => {});
    }
    res.status(500).json({ error: "Failed to process receipt" });
  }
});

// ======================================================
// 🗣️ AssemblyAI transcription routes
// ======================================================
async function uploadToAssemblyAI(filePath) {
  const data = fs.readFileSync(filePath);
  const response = await axios.post(`${BASE_URL}/upload`, data, {
    headers: {
      authorization: ASSEMBLYAI_KEY,
      "content-type": "application/octet-stream",
    },
  });
  return response.data.upload_url;
}

// ======================================================
// 🤖 AI Behavior Analysis via OpenAI
// ======================================================
app.post("/ai/behavior-analysis", async (req, res) => {
  try {
    if (!openai) {
      return res.status(500).json({ error: "OpenAI API key not configured" });
    }

    const {
      expenses = [],
      incomes = [],
      debts = [],
      budget = {},
      savings = 0,
      currentMonthKey,
    } = req.body;

    // Calculate key metrics
    const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const totalIncome = incomes.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
    const totalDebt = debts.reduce((sum, d) => sum + (Number(d.currentBalance) || 0), 0);
    const monthlyDebtPayments = debts.reduce((sum, d) => sum + (Number(d.monthlyPayment) || 0), 0);
    const budgetTotal = budget.totalBudget || 0;
    const budgetSpent = budget.totalSpent || 0;
    const budgetRemaining = budget.remaining || 0;
    const budgetUsedPct = budgetTotal > 0 ? (budgetSpent / budgetTotal) * 100 : 0;

    // Category breakdown
    const categoryBreakdown = expenses.reduce((acc, e) => {
      const cat = e.category || "Others";
      acc[cat] = (acc[cat] || 0) + (Number(e.amount) || 0);
      return acc;
    }, {});

    // Calculate DTI (Debt-to-Income ratio)
    const dti = totalIncome > 0 ? (monthlyDebtPayments / totalIncome) * 100 : 0;

    // Calculate savings rate
    const netCashflow = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? (netCashflow / totalIncome) * 100 : 0;

    // Build context for AI
    const financialContext = {
      currentMonth: currentMonthKey || new Date().toISOString().slice(0, 7),
      income: {
        total: totalIncome,
        count: incomes.length,
        sources: incomes.map((i) => ({
          amount: Number(i.amount) || 0,
          category: i.category || "Others",
          date: i.dateISO,
        })),
      },
      expenses: {
        total: totalExpenses,
        count: expenses.length,
        byCategory: categoryBreakdown,
        transactions: expenses.slice(0, 20).map((e) => ({
          amount: Number(e.amount) || 0,
          category: e.category || "Others",
          date: e.dateISO,
          description: e.description || e.note || "",
        })),
      },
      budget: {
        total: budgetTotal,
        spent: budgetSpent,
        remaining: budgetRemaining,
        usedPercentage: budgetUsedPct,
        allocations: budget.allocations || {},
      },
      debt: {
        totalBalance: totalDebt,
        monthlyPayments: monthlyDebtPayments,
        count: debts.length,
        dti: dti,
        debts: debts.map((d) => ({
          name: d.name || "Unknown",
          currentBalance: Number(d.currentBalance) || 0,
          monthlyPayment: Number(d.monthlyPayment) || 0,
          originalAmount: Number(d.originalAmount) || 0,
        })),
      },
      savings: {
        liquid: savings,
        rate: savingsRate,
        netCashflow: netCashflow,
      },
    };

    const systemPrompt = `You are an expert financial advisor AI assistant. Analyze the user's financial data and provide personalized, actionable insights.

Your task:
1. Analyze expenses, income, debt, budget, and savings comprehensively
2. Identify critical issues that need immediate attention (alerts)
3. Provide warnings for concerning patterns
4. Offer positive reinforcement for good financial habits
5. Give specific, actionable recommendations

CRITICAL RULES:
- ALERTS (critical issues) MUST be at the top of your response
- Prioritize by severity: critical > warning > info
- Be specific with numbers and amounts (use RM currency)
- Provide actionable advice, not just observations
- Consider Malaysian financial context (SST, common expenses, etc.)

Response format (JSON):
{
  "insights": [
    {
      "message": "Clear, concise insight message",
      "severity": "critical" | "warning" | "info",
      "icon": "emoji or icon identifier",
      "type": "category name for grouping",
      "actionable": true/false
    }
  ],
  "summary": {
    "overallHealth": "excellent" | "good" | "fair" | "poor",
    "keyConcerns": ["list of main concerns"],
    "positiveHighlights": ["list of good things"]
  }
}`;

    const userPrompt = `Analyze this user's financial situation for ${financialContext.currentMonth}:

INCOME:
- Total: RM ${totalIncome.toFixed(2)}
- Sources: ${incomes.length} income records
${incomes.length > 0 ? `- Breakdown: ${JSON.stringify(financialContext.income.sources.slice(0, 5))}` : ""}

EXPENSES:
- Total: RM ${totalExpenses.toFixed(2)}
- Transactions: ${expenses.length}
- Category breakdown: ${JSON.stringify(categoryBreakdown)}

BUDGET:
- Budget set: RM ${budgetTotal.toFixed(2)}
- Spent: RM ${budgetSpent.toFixed(2)} (${budgetUsedPct.toFixed(1)}% used)
- Remaining: RM ${budgetRemaining.toFixed(2)}
${budget.allocations ? `- Allocations: ${JSON.stringify(budget.allocations)}` : ""}

DEBT:
- Total debt balance: RM ${totalDebt.toFixed(2)}
- Monthly payments: RM ${monthlyDebtPayments.toFixed(2)}
- Debt-to-Income ratio: ${dti.toFixed(1)}%
- Number of debts: ${debts.length}
${debts.length > 0 ? `- Details: ${JSON.stringify(financialContext.debt.debts)}` : ""}

SAVINGS:
- Liquid savings: RM ${savings.toFixed(2)}
- Savings rate: ${savingsRate.toFixed(1)}%
- Net cashflow: RM ${netCashflow.toFixed(2)}

Provide comprehensive analysis with:
1. Critical alerts (budget exceeded, negative savings, high DTI, etc.) at the top
2. Warnings (approaching limits, concerning trends)
3. Positive insights (good habits, achievements)
4. Actionable recommendations

Focus on what matters most for financial health.`;

    // Add timeout to OpenAI API call (15 seconds max)
    const openaiPromise = openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("OpenAI API timeout")), 15000);
    });

    // Race between OpenAI and timeout
    const response = await Promise.race([openaiPromise, timeoutPromise]);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const analysis = JSON.parse(content);

    // Ensure insights array exists and is properly formatted
    if (!Array.isArray(analysis.insights)) {
      analysis.insights = [];
    }

    // Sort insights by severity (critical first, then warning, then info)
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    analysis.insights.sort((a, b) => {
      const aSev = severityOrder[a.severity] ?? 2;
      const bSev = severityOrder[b.severity] ?? 2;
      return aSev - bSev;
    });

    // Add default icons if missing
    analysis.insights.forEach((insight) => {
      if (!insight.icon) {
        if (insight.severity === "critical") insight.icon = "🚨";
        else if (insight.severity === "warning") insight.icon = "⚠️";
        else insight.icon = "💡";
      }
    });

    res.json({
      success: true,
      monthKey: financialContext.currentMonth,
      insights: analysis.insights,
      summary: analysis.summary || {},
      metrics: {
        totalExpenses,
        totalIncome,
        netCashflow,
        savingsRate,
        dti,
        budgetUsedPct,
      },
    });
  } catch (err) {
    console.error("AI Behavior Analysis error:", err.message || err);
    
    // If timeout or OpenAI error, return basic insights instead of failing
    if (err.message?.includes("timeout") || err.message?.includes("OpenAI")) {
      console.log("⚠️ AI analysis timed out, returning basic insights");
      
      // Calculate basic metrics
      const totalExpenses = (req.body.expenses || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      const totalIncome = (req.body.incomes || []).reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
      const budgetTotal = req.body.budget?.totalBudget || 0;
      const budgetSpent = req.body.budget?.totalSpent || 0;
      const budgetRemaining = req.body.budget?.remaining || 0;
      const budgetUsedPct = budgetTotal > 0 ? (budgetSpent / budgetTotal) * 100 : 0;
      const netCashflow = totalIncome - totalExpenses;
      const savingsRate = totalIncome > 0 ? (netCashflow / totalIncome) * 100 : 0;
      
      // Generate basic insights without AI
      const basicInsights = [];
      
      if (budgetTotal > 0) {
        if (budgetUsedPct > 100) {
          basicInsights.push({
            message: `⚠️ You've exceeded your budget by RM ${Math.abs(budgetRemaining).toFixed(2)}. Consider reviewing your spending.`,
            severity: "critical",
            icon: "🚨",
            type: "budget",
            actionable: true,
          });
        } else if (budgetUsedPct > 80) {
          basicInsights.push({
            message: `You've used ${budgetUsedPct.toFixed(1)}% of your budget. RM ${budgetRemaining.toFixed(2)} remaining this month.`,
            severity: "warning",
            icon: "⚠️",
            type: "budget",
            actionable: true,
          });
        } else if (budgetRemaining > 50) {
          basicInsights.push({
            message: `Great! You're on track with RM ${budgetRemaining.toFixed(2)} remaining in your budget.`,
            severity: "info",
            icon: "✅",
            type: "budget",
            actionable: false,
          });
        }
      }
      
      if (netCashflow < 0) {
        basicInsights.push({
          message: `Your expenses exceed income by RM ${Math.abs(netCashflow).toFixed(2)} this month. Consider reducing spending.`,
          severity: "critical",
          icon: "🚨",
          type: "cashflow",
          actionable: true,
        });
      } else if (savingsRate > 20) {
        basicInsights.push({
          message: `Excellent savings rate of ${savingsRate.toFixed(1)}%! You saved RM ${netCashflow.toFixed(2)} this month.`,
          severity: "info",
          icon: "✅",
          type: "savings",
          actionable: false,
        });
      }
      
      // Category insights
      const categoryBreakdown = (req.body.expenses || []).reduce((acc, e) => {
        const cat = e.category || "Others";
        acc[cat] = (acc[cat] || 0) + (Number(e.amount) || 0);
        return acc;
      }, {});
      
      const topCategory = Object.entries(categoryBreakdown)
        .sort(([, a], [, b]) => b - a)[0];
      
      if (topCategory && topCategory[1] > totalExpenses * 0.3) {
        basicInsights.push({
          message: `${topCategory[0]} is your largest expense category (RM ${topCategory[1].toFixed(2)}). Review if this is necessary.`,
          severity: "warning",
          icon: "💡",
          type: "category",
          actionable: true,
        });
      }
      
      return res.json({
        success: true,
        monthKey: req.body.currentMonthKey || new Date().toISOString().slice(0, 7),
        insights: basicInsights,
        summary: {
          overallHealth: netCashflow >= 0 && budgetUsedPct < 100 ? "good" : "fair",
          keyConcerns: netCashflow < 0 ? ["Negative cashflow"] : [],
          positiveHighlights: savingsRate > 20 ? ["Good savings rate"] : [],
        },
        metrics: {
          totalExpenses,
          totalIncome,
          netCashflow,
          savingsRate,
          dti: 0,
          budgetUsedPct,
        },
      });
    }
    
    res.status(500).json({
      error: "Failed to analyze behavior",
      message: err.message,
    });
  }
});

app.post("/transcribe", upload.single("file"), async (req, res) => {
  try {
    const uploadUrl = await uploadToAssemblyAI(req.file.path);
    const transcriptRes = await axios.post(
      `${BASE_URL}/transcript`,
      { audio_url: uploadUrl },
      {
        headers: { authorization: ASSEMBLYAI_KEY, "content-type": "application/json" },
      }
    );

    const transcriptId = transcriptRes.data.id;
    let text;

    while (true) {
      const pollingRes = await axios.get(`${BASE_URL}/transcript/${transcriptId}`, {
        headers: { authorization: ASSEMBLYAI_KEY },
      });

      if (pollingRes.data.status === "completed") {
        text = pollingRes.data.text;
        break;
      } else if (pollingRes.data.status === "error") {
        throw new Error(pollingRes.data.error);
      }

      await new Promise((r) => setTimeout(r, 3000));
    }

    res.json({ text });
  } catch (err) {
    console.error("❌ Backend error (transcribe):", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// ======================================================
// 📊 Monthly Snapshot Builder (Backend)
// ======================================================
function getCurrentMonthKey(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

function getMonthDateRange(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 1, 0, 0, 0, 0);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

function getPreviousMonthKey(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  const prevDate = new Date(y, m - 2, 1);
  const prevY = prevDate.getFullYear();
  const prevM = prevDate.getMonth() + 1;
  return `${prevY}-${String(prevM).padStart(2, "0")}`;
}

function normalizeUserPath(userId) {
  return userId?.startsWith("/USERS/") ? userId : `/USERS/${userId}`;
}

function toISO(maybeDate) {
  if (!maybeDate) return "";
  if (maybeDate.toDate && typeof maybeDate.toDate === "function") {
    return maybeDate.toDate().toISOString();
  }
  if (typeof maybeDate === "string") return maybeDate;
  if (maybeDate instanceof Date) return maybeDate.toISOString();
  return String(maybeDate);
}

const SAVINGS_CATEGORY_NAMES = ["Savings", "Saving", "Emergency Fund", "Emergency", "Investments", "Investment"];
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const round4 = (n) => Math.round((Number(n) || 0) * 10000) / 10000;
const TINY_TOTAL_THRESHOLD = 50;

const toNumberRecord = (record = {}) => {
  const output = {};
  Object.entries(record || {}).forEach(([key, value]) => {
    const num = Number(value);
    output[key] = Number.isFinite(num) ? num : 0;
  });
  return output;
};

// Fast minimal snapshot for chat - only fetches essential data (expenses + incomes + basic totals)
// This is much faster than the full snapshot and sufficient for chat analysis
// Optimized for speed with large datasets by:
// 1. Fetching expenses and incomes in parallel
// 2. Using date range queries when possible
// 3. Limiting fallback queries to 200 records
// 4. Skipping expensive operations (debts, savings goals, budget calculations)
async function buildFastMinimalSnapshot(userId, monthKey = getCurrentMonthKey()) {
  if (!db) {
    console.warn("⚠️ buildFastMinimalSnapshot called without Firestore. Returning null.");
    return null;
  }

  console.log(`⚡ Building FAST minimal snapshot for userId: ${userId}, monthKey: ${monthKey}`);
  const startTime = Date.now();

  const userPath = normalizeUserPath(userId);
  const { startISO, endISO } = getMonthDateRange(monthKey);
  const startDateObj = new Date(startISO);
  const endDateObj = new Date(endISO);
  const startTimestamp = admin.firestore.Timestamp.fromDate(startDateObj);
  const endTimestamp = admin.firestore.Timestamp.fromDate(endDateObj);

  // Fetch expenses and incomes in parallel for speed
  let monthExpenses = [];
  let monthIncomes = [];
  
  try {
    const [expensesSnap, incomesSnap] = await Promise.all([
      // Try date range query first
      db.collection("EXPENSES")
        .where("user_id", "==", userPath)
        .where("exp_date", ">=", startTimestamp)
        .where("exp_date", "<", endTimestamp)
        .get()
        .catch(() => null),
      db.collection("INCOME")
        .where("user_id", "==", userPath)
        .where("inc_date", ">=", startTimestamp)
        .where("inc_date", "<", endTimestamp)
        .get()
        .catch(() => null)
    ]);

    // Process expenses
    if (expensesSnap && !expensesSnap.empty) {
      monthExpenses = expensesSnap.docs.map((doc) => {
        const d = doc.data();
        return {
          amount: Number(d.exp_total) || 0,
          category: d.exp_category || "Uncategorized",
        };
      });
    } else {
      // Fallback: fetch all and filter in memory (faster than full snapshot)
      const allExpensesSnap = await db.collection("EXPENSES")
        .where("user_id", "==", userPath)
        .limit(200) // Limit to prevent excessive data
        .get();
      monthExpenses = allExpensesSnap.docs
        .map((doc) => {
          const d = doc.data();
          const dateISO = toISO(d.exp_date || d.created_at);
          return {
            amount: Number(d.exp_total) || 0,
            category: d.exp_category || "Uncategorized",
            dateISO,
          };
        })
        .filter((r) => r.dateISO >= startISO && r.dateISO < endISO);
    }

    // Process incomes
    if (incomesSnap && !incomesSnap.empty) {
      monthIncomes = incomesSnap.docs.map((doc) => {
        const d = doc.data();
        return {
          amount: Number(d.inc_total) || 0,
          category: d.inc_category || "Uncategorized",
        };
      });
    } else {
      // Fallback: fetch all and filter in memory
      const allIncomesSnap = await db.collection("INCOME")
        .where("user_id", "==", userPath)
        .limit(200)
        .get();
      monthIncomes = allIncomesSnap.docs
        .map((doc) => {
          const d = doc.data();
          const dateISO = toISO(d.inc_date || d.created_at);
          return {
            amount: Number(d.inc_total) || 0,
            category: d.inc_category || "Uncategorized",
            dateISO,
          };
        })
        .filter((r) => r.dateISO >= startISO && r.dateISO < endISO);
    }

    // Calculate basic totals (fast)
    const totalIncome = monthIncomes.reduce((sum, r) => sum + r.amount, 0);
    const consumptionExpenses = monthExpenses.filter((exp) => {
      const cat = (exp.category || "").trim();
      return !SAVINGS_CATEGORY_NAMES.some((name) => name.toLowerCase() === cat.toLowerCase());
    });
    const consumptionTotal = consumptionExpenses.reduce((sum, r) => sum + r.amount, 0);
    
    // Group expenses by category for basic insights
    const categoryTotals = {};
    consumptionExpenses.forEach((exp) => {
      const cat = exp.category || "Uncategorized";
      categoryTotals[cat] = (categoryTotals[cat] || 0) + exp.amount;
    });

    const elapsed = Date.now() - startTime;
    console.log(`✅ Fast snapshot built in ${elapsed}ms: ${monthExpenses.length} expenses, ${monthIncomes.length} incomes`);

    // Return minimal snapshot structure
    return {
      totalIncome: round2(totalIncome),
      spendingTotals: {
        income: round2(totalIncome),
        spending: round2(consumptionTotal),
        savingsContrib: 0, // Not calculated in fast mode
        netCashFlow: round2(totalIncome - consumptionTotal),
      },
      categoryBreakdown: categoryTotals,
      expensesCount: monthExpenses.length,
      incomesCount: monthIncomes.length,
      // Mark as fast/minimal snapshot
      _fastSnapshot: true,
    };
  } catch (err) {
    console.error("❌ Error building fast snapshot:", err.message);
    return null;
  }
}

// Build snapshot for last 3 months - aggregates data from current month and 2 previous months
async function build3MonthSnapshot(userId) {
  if (!db) {
    console.warn("⚠️ build3MonthSnapshot called without Firestore. Returning null.");
    return null;
  }

  console.log(`📊 Building 3-month snapshot for userId: ${userId}`);
  const startTime = Date.now();

  const currentMonthKey = getCurrentMonthKey();
  const monthKeys = [];
  
  // Get current month and 2 previous months
  let date = new Date();
  for (let i = 0; i < 3; i++) {
    monthKeys.push(getCurrentMonthKey(date));
    date.setMonth(date.getMonth() - 1);
  }

  // Fetch snapshots for all 3 months in parallel with individual timeouts
  // Use longer timeout since snapshots can take 3-5 seconds with large datasets
  const snapshotPromises = monthKeys.map(async (monthKey) => {
    try {
      const snapshotPromise = buildFastMinimalSnapshot(userId, monthKey);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout for ${monthKey}`)), 8000); // 8 second timeout per month (snapshots can take 3-5 seconds)
      });
      return await Promise.race([snapshotPromise, timeoutPromise]);
    } catch (err) {
      console.warn(`⚠️ Snapshot for ${monthKey} failed or timed out:`, err.message);
      return null; // Return null if one month fails, continue with others
    }
  });
  
  const snapshots = await Promise.all(snapshotPromises);

  // Aggregate data across all 3 months
  const aggregated = {
    months: [],
    totals: {
      totalIncome: 0,
      totalSpending: 0,
      totalNetCashFlow: 0,
      totalExpensesCount: 0,
      totalIncomesCount: 0,
    },
    categoryBreakdown: {},
    currentMonthKey,
  };

  snapshots.forEach((snapshot, index) => {
    if (snapshot) {
      const monthData = {
        monthKey: monthKeys[index],
        totalIncome: snapshot.totalIncome || 0,
        totalSpending: snapshot.spendingTotals?.spending || 0,
        netCashFlow: snapshot.spendingTotals?.netCashFlow || 0,
        expensesCount: snapshot.expensesCount || 0,
        incomesCount: snapshot.incomesCount || 0,
        categoryBreakdown: snapshot.categoryBreakdown || {},
      };
      
      aggregated.months.push(monthData);
      aggregated.totals.totalIncome += monthData.totalIncome;
      aggregated.totals.totalSpending += monthData.totalSpending;
      aggregated.totals.totalNetCashFlow += monthData.netCashFlow;
      aggregated.totals.totalExpensesCount += monthData.expensesCount;
      aggregated.totals.totalIncomesCount += monthData.incomesCount;

      // Aggregate category breakdown
      Object.entries(monthData.categoryBreakdown).forEach(([cat, amount]) => {
        aggregated.categoryBreakdown[cat] = (aggregated.categoryBreakdown[cat] || 0) + amount;
      });
    } else {
      console.warn(`⚠️ Snapshot for ${monthKeys[index]} returned null, skipping`);
    }
  });
  
  // If no months were successfully loaded, return null
  if (aggregated.months.length === 0) {
    console.warn("⚠️ No months successfully loaded in 3-month snapshot, returning null");
    return null;
  }

  // Calculate averages
  const monthCount = aggregated.months.length;
  aggregated.averages = {
    monthlyIncome: monthCount > 0 ? round2(aggregated.totals.totalIncome / monthCount) : 0,
    monthlySpending: monthCount > 0 ? round2(aggregated.totals.totalSpending / monthCount) : 0,
    monthlyNetCashFlow: monthCount > 0 ? round2(aggregated.totals.totalNetCashFlow / monthCount) : 0,
  };

  const elapsed = Date.now() - startTime;
  console.log(`✅ 3-month snapshot built in ${elapsed}ms: ${aggregated.months.length} months of data`);

  return aggregated;
}

// Savings cash flow source of truth:
// - We use SAVINGS_GOALS/{goalId}/CONTRIBUTIONS as the ONLY source for savingsContrib.
// - EXPENSES with category "Savings" are ignored for savings calculations to avoid double counting.
// - Over time, we should stop writing "Savings" EXPENSE rows altogether.
async function buildMonthlySnapshotFromFirestore(userId, monthKey = getCurrentMonthKey()) {
  if (!db) {
    // When Firestore isn't configured on the backend, just return null so callers can handle it.
    console.warn("⚠️ buildMonthlySnapshotFromFirestore called without Firestore. Returning null.");
    return null;
  }

  console.log(`📊 Building snapshot for userId: ${userId}, monthKey: ${monthKey}`);

  const userPath = normalizeUserPath(userId);
  // TODO: replace this userId from request with a verified uid from auth middleware.
  // Right now we trust userId from the client, which is NOT safe for production.
  const { startISO, endISO } = getMonthDateRange(monthKey);
  const startDateObj = new Date(startISO);
  const endDateObj = new Date(endISO);
  const startTimestamp = admin.firestore.Timestamp.fromDate(startDateObj);
  const endTimestamp = admin.firestore.Timestamp.fromDate(endDateObj);

  // Fetch expenses for this month (OPTIMIZED: Use date range query instead of fetching all)
  let monthExpenses = [];
  try {
    // Try date range query first (same as fast snapshot)
    let expensesSnap = null;
    try {
      expensesSnap = await db
        .collection("EXPENSES")
        .where("user_id", "==", userPath)
        .where("exp_date", ">=", startTimestamp)
        .where("exp_date", "<", endTimestamp)
        .get();
    } catch (queryErr) {
      console.log(`⚠️ Date range query failed: ${queryErr.message}, using fallback`);
      expensesSnap = null;
    }

    if (expensesSnap && !expensesSnap.empty && expensesSnap.docs.length > 0) {
      monthExpenses = expensesSnap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          amount: Number(d.exp_total) || 0,
          category: d.exp_category || "Uncategorized",
          dateISO: toISO(d.exp_date || d.created_at),
          description: d.exp_notes || "",
          paymentMethod: d.exp_payment_method || "",
        };
      });
      console.log(`📊 Found ${monthExpenses.length} expenses for ${monthKey} (date range query)`);
    } else {
      // Fallback: fetch all and filter in memory (same as fast snapshot)
      console.log(`⚠️ Date range query returned empty/null (snap=${expensesSnap ? 'exists' : 'null'}, empty=${expensesSnap?.empty}), using fallback method`);
      const allExpensesSnap = await db
        .collection("EXPENSES")
        .where("user_id", "==", userPath)
        .limit(500) // Increased limit for full snapshot
        .get();
      console.log(`📊 Fetched ${allExpensesSnap.docs.length} total expenses from DB for filtering`);
      const allExpenses = allExpensesSnap.docs.map((doc) => {
        const d = doc.data();
        const dateISO = toISO(d.exp_date || d.created_at);
        return {
          id: doc.id,
          amount: Number(d.exp_total) || 0,
          category: d.exp_category || "Uncategorized",
          dateISO: dateISO,
          description: d.exp_notes || "",
          paymentMethod: d.exp_payment_method || "",
        };
      });
      console.log(`📊 Date range filter: ${startISO} <= dateISO < ${endISO}`);
      monthExpenses = allExpenses.filter(
        (r) => r.dateISO >= startISO && r.dateISO < endISO
      );
      console.log(`📊 Found ${monthExpenses.length} expenses for ${monthKey} (fallback mode, filtered from ${allExpenses.length} total)`);
      if (monthExpenses.length === 0 && allExpenses.length > 0) {
        console.log(`⚠️ No expenses match date range. Sample dates from DB:`, allExpenses.slice(0, 3).map(e => e.dateISO));
      }
    }
    
    if (monthExpenses.length > 0) {
      const categoryBreakdown = {};
      monthExpenses.forEach(exp => {
        const cat = exp.category || "Uncategorized";
        categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + exp.amount;
      });
      console.log(`📊 Expense categories breakdown (${Object.keys(categoryBreakdown).length} categories):`, categoryBreakdown);
    } else {
      console.log(`⚠️ No expenses found for ${monthKey} - category insights will be empty`);
    }
  } catch (err) {
    console.error("❌ Error fetching expenses:", err.message, err.stack?.substring(0, 200));
    monthExpenses = [];
  }

  // Fetch incomes for this month (OPTIMIZED: Use date range query instead of fetching all)
  let monthIncomes = [];
  try {
    // Try date range query first (same as fast snapshot)
    const incomesSnap = await db
      .collection("INCOME")
      .where("user_id", "==", userPath)
      .where("inc_date", ">=", startTimestamp)
      .where("inc_date", "<", endTimestamp)
      .get()
      .catch(() => null);

    if (incomesSnap && !incomesSnap.empty) {
      monthIncomes = incomesSnap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          amount: Number(d.inc_total) || 0,
          category: d.inc_category || "Uncategorized",
          dateISO: toISO(d.inc_date || d.created_at),
          description: d.inc_notes || "",
          paymentMethod: d.inc_payment_method || "",
        };
      });
      console.log(`📊 Found ${monthIncomes.length} incomes for ${monthKey} (date range query)`);
    } else {
      // Fallback: fetch all and filter in memory (same as fast snapshot)
      console.log(`⚠️ Date range query returned empty, using fallback method for incomes`);
      const allIncomesSnap = await db
        .collection("INCOME")
        .where("user_id", "==", userPath)
        .limit(500) // Increased limit for full snapshot
        .get();
      const allIncomes = allIncomesSnap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          amount: Number(d.inc_total) || 0,
          category: d.inc_category || "Uncategorized",
          dateISO: toISO(d.inc_date || d.created_at),
          description: d.inc_notes || "",
          paymentMethod: d.inc_payment_method || "",
        };
      });
      monthIncomes = allIncomes.filter(
        (r) => r.dateISO >= startISO && r.dateISO < endISO
      );
      console.log(`📊 Found ${monthIncomes.length} incomes for ${monthKey} (fallback mode, filtered from ${allIncomes.length} total)`);
    }
  } catch (err) {
    console.error("❌ Error fetching incomes:", err.message);
    monthIncomes = [];
  }

  // Fetch debts
  let debts = [];
  try {
    const debtsSnap = await db
      .collection("DEBTS")
      .where("user_id", "==", userPath)
      .get();

    for (const doc of debtsSnap.docs) {
      try {
        const d = doc.data();
        const paymentsSnap = await doc.ref.collection("PAYMENTS").limit(20).get();
        const payments = paymentsSnap.docs.map((p) => ({
          id: p.id,
          amount: Number(p.data().amount) || 0,
          dateISO: toISO(p.data().date_iso),
          note: p.data().note || "",
        }));

        debts.push({
          id: doc.id,
          name: d.name || "",
          type: d.type || "Other",
          originalAmount: Number(d.original_amount) || 0,
          currentBalance: Number(d.current_balance) || 0,
          monthlyPayment: Number(d.monthly_payment) || 0,
          targetDate: d.target_date || null,
          payments,
          createdAt: toISO(d.created_at),
        });
      } catch (err) {
        console.error(`❌ Error processing debt ${doc.id}:`, err.message);
      }
    }
    console.log(`📊 Found ${debts.length} debts`);
  } catch (err) {
    console.error("❌ Error fetching debts:", err.message);
    debts = [];
  }

  // Fetch savings goals and contributions
  let savingsGoals = [];
  let savingsContributions = [];
  try {
    const goalsSnap = await db
      .collection("SAVINGS_GOALS")
      .where("user_id", "==", userPath)
      .get();

    for (const goalDoc of goalsSnap.docs) {
      try {
        const g = goalDoc.data();
        const goalId = goalDoc.id;
        
        // Fetch contributions for this goal in this month
        const contribsSnap = await goalDoc.ref
          .collection("CONTRIBUTIONS")
          .where("date", ">=", startTimestamp)
          .where("date", "<", endTimestamp)
          .get();

        const monthContribs = contribsSnap.docs.map((c) => {
          const cd = c.data();
          const date = cd.date?.toDate ? cd.date.toDate() : new Date(cd.date || Date.now());
          return {
            id: c.id,
            goalId,
            amount: Number(cd.amount) || 0,
            date: date,
            source: cd.source || "",
            note: cd.note || "",
          };
        });

        savingsContributions.push(...monthContribs);

        const deadline = g.deadline?.toDate ? g.deadline.toDate() : (g.deadline ? new Date(g.deadline) : null);
        const createdAt = g.created_at?.toDate ? g.created_at.toDate() : (g.created_at ? new Date(g.created_at) : null);
        const updatedAt = g.updated_at?.toDate ? g.updated_at.toDate() : (g.updated_at ? new Date(g.updated_at) : null);

        savingsGoals.push({
          id: goalId,
          userId: g.user_id || userPath,
          name: g.name || "",
          targetAmount: Number(g.target_amount) || 0,
          currentAmount: Number(g.current_amount) || 0,
          monthlyTarget: g.monthly_target !== undefined ? (g.monthly_target ? Number(g.monthly_target) : null) : null,
          deadline,
          category: g.category || "",
          notes: g.notes || "",
          createdAt,
          updatedAt,
        });
      } catch (err) {
        console.error(`❌ Error processing savings goal ${goalDoc.id}:`, err.message);
      }
    }
    console.log(`📊 Found ${savingsGoals.length} savings goals, ${savingsContributions.length} contributions for ${monthKey}`);
  } catch (err) {
    console.error("❌ Error fetching savings goals:", err.message);
    savingsGoals = [];
    savingsContributions = [];
  }

  // Fetch budget record for the month
  let budgetDoc = null;
  try {
    const budgetSnap = await db
      .collection("BUDGET")
      .where("user_id", "==", userPath)
      .where("month_key", "==", monthKey)
      .limit(1)
      .get();
    if (!budgetSnap.empty) {
      budgetDoc = budgetSnap.docs[0].data();
    }
  } catch (err) {
    console.error("❌ Error fetching budget record:", err.message);
  }

  // Calculate totals & savings contributions (CONTRIBUTIONS = source of truth)
  const totalIncome = monthIncomes.reduce((sum, r) => sum + r.amount, 0);
  const monthlySavingsContrib = savingsContributions.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  console.log(`📊 Financial totals: income=${totalIncome}, savingsContrib=${monthlySavingsContrib}, expensesCount=${monthExpenses.length}`);

  console.log(`📊 Processing ${monthExpenses.length} expenses for budget calculation`);
  if (monthExpenses.length > 0) {
    console.log(`📊 Expense categories:`, monthExpenses.map(e => ({ cat: e.category, amount: e.amount })).slice(0, 5));
  }

  const consumptionExpenses = monthExpenses.filter((exp) => {
    const cat = (exp.category || "").trim();
    return !SAVINGS_CATEGORY_NAMES.some((name) => name.toLowerCase() === cat.toLowerCase());
  });
  const ignoredSavingsExpenseCount = monthExpenses.length - consumptionExpenses.length;
  console.log(`📊 Consumption expenses: ${consumptionExpenses.length}, Savings expenses: ${ignoredSavingsExpenseCount}`);
  if (ignoredSavingsExpenseCount > 0) {
    console.log(`ℹ️ Ignored ${ignoredSavingsExpenseCount} savings expense rows to avoid double counting.`);
  }

  const consumptionTotal = consumptionExpenses.reduce((sum, r) => sum + r.amount, 0);
  const totalExpenses = round2(consumptionTotal + monthlySavingsContrib);
  const savings = round2(totalIncome - totalExpenses);
  const legacySavingsRate = totalIncome > 0 ? savings / totalIncome : 0;
  const netCashFlow = round2(totalIncome - (consumptionTotal + monthlySavingsContrib));

  const spendingTotals = {
    income: round2(totalIncome),
    spending: round2(consumptionTotal),
    savingsContrib: round2(monthlySavingsContrib),
    netCashFlow,
  };

  const totalGoalTarget = savingsGoals.reduce((sum, g) => sum + (Number(g.targetAmount) || 0), 0);
  const totalGoalCurrent = savingsGoals.reduce((sum, g) => sum + (Number(g.currentAmount) || 0), 0);
  const emergencyGoal = savingsGoals.find((g) => (g.category || "").toLowerCase().includes("emergency"));
  let emergencyFundMonths = null;
  if (emergencyGoal && consumptionTotal > 0) {
    const emergencyBalance = Number(emergencyGoal.currentAmount) || 0;
    emergencyFundMonths = emergencyBalance / consumptionTotal;
  }

  const savingsSummary = {
    savingsContrib: round2(monthlySavingsContrib),
    savingsRate: round4(totalIncome > 0 ? monthlySavingsContrib / totalIncome : 0),
    goalsCount: savingsGoals.length,
    totalGoalTarget: round2(totalGoalTarget),
    totalGoalCurrent: round2(totalGoalCurrent),
    emergencyFundMonths: emergencyFundMonths !== null ? round2(emergencyFundMonths) : null,
  };

  const totalDebtVal = debts.reduce((sum, d) => sum + d.currentBalance, 0);
  const monthlyDebtPaymentsVal = debts.reduce((sum, d) => sum + d.monthlyPayment, 0);
  const dtiRatio = totalIncome > 0 && monthlyDebtPaymentsVal > 0 ? monthlyDebtPaymentsVal / totalIncome : null;
  const debtSummary = debts.length
    ? {
        totalDebt: round2(totalDebtVal),
        totalMonthlyDebtPayment: round2(monthlyDebtPaymentsVal),
        debtToIncomeRatio: dtiRatio !== null ? round4(dtiRatio) : null,
        debtsCount: debts.length,
      }
    : undefined;

  // Group expenses by category
  // IMPORTANT: For budget comparison, we need to include ALL expenses (both consumption and savings)
  // because the user may have budget allocations for savings categories too
  const categoryTotals = {};
  
  // First, add all consumption expenses
  consumptionExpenses.forEach((exp) => {
    const cat = exp.category || "Uncategorized";
    categoryTotals[cat] = (categoryTotals[cat] || 0) + exp.amount;
  });
  console.log(`📊 Category totals after consumption expenses:`, Object.keys(categoryTotals).length, "categories", Object.keys(categoryTotals));
  
  // Also include savings expenses - they should count toward budget if user has savings budget
  const savingsExpenses = monthExpenses.filter((exp) => {
    const cat = (exp.category || "").trim();
    return SAVINGS_CATEGORY_NAMES.some((name) => name.toLowerCase() === cat.toLowerCase());
  });
  console.log(`📊 Found ${savingsExpenses.length} savings expenses`);
  
  savingsExpenses.forEach((exp) => {
    const cat = exp.category || "Uncategorized";
    categoryTotals[cat] = (categoryTotals[cat] || 0) + exp.amount;
  });
  
  console.log(`📊 Category totals after adding savings:`, Object.keys(categoryTotals).length, "categories", Object.keys(categoryTotals));

  // Get previous month data for comparison (OPTIMIZED: Fetch only previous month)
  const prevMonthKey = getPreviousMonthKey(monthKey);
  const prevRange = getMonthDateRange(prevMonthKey);
  const prevStartTimestamp = admin.firestore.Timestamp.fromDate(new Date(prevRange.startISO));
  const prevEndTimestamp = admin.firestore.Timestamp.fromDate(new Date(prevRange.endISO));
  
  let prevExpenses = [];
  try {
    const prevExpensesSnap = await db
      .collection("EXPENSES")
      .where("user_id", "==", userPath)
      .where("exp_date", ">=", prevStartTimestamp)
      .where("exp_date", "<", prevEndTimestamp)
      .get();
    prevExpenses = prevExpensesSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        amount: Number(d.exp_total) || 0,
        category: d.exp_category || "Uncategorized",
        dateISO: toISO(d.exp_date || d.created_at),
        description: d.exp_notes || "",
        paymentMethod: d.exp_payment_method || "",
      };
    });
  } catch (err) {
    console.warn("⚠️ Could not fetch previous month expenses for comparison:", err.message);
    prevExpenses = [];
  }
  const prevCategoryTotals = {};
  prevExpenses.forEach((exp) => {
    const cat = exp.category || "Uncategorized";
    prevCategoryTotals[cat] = (prevCategoryTotals[cat] || 0) + exp.amount;
  });

  // Build categories array with change percentages
  const categories = Object.entries(categoryTotals)
    .map(([name, amount]) => {
      const prevAmount = prevCategoryTotals[name] || 0;
      const changePct = prevAmount > 0 ? ((amount - prevAmount) / prevAmount) * 100 : null;
      return {
        name,
        amount: round2(amount),
        changePctVsPrevMonth: changePct !== null ? round2(changePct) : null,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  // Debt health score (unchanged formula)
  let debtHealthScore = null;
  if (debts.length > 0) {
    const totalMonthlyPayments = debts.reduce((sum, d) => sum + d.monthlyPayment, 0);
    const dtiForScore = totalIncome > 0 ? totalMonthlyPayments / totalIncome : 0;
    const dtiScore = Math.max(0, 100 - Math.max(0, dtiForScore * 100 - 15) * 1.8);

    const progressScores = debts.map((d) => {
      if (d.originalAmount <= 0) return 50;
      const progress = ((d.originalAmount - d.currentBalance) / d.originalAmount) * 100;
      return Math.min(100, Math.max(0, progress));
    });
    const progressScore = progressScores.reduce((a, b) => a + b, 0) / progressScores.length;

    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const consistencyScores = debts.map((d) => {
      const recentPayments = (d.payments || []).filter(
        (p) => new Date(p.dateISO) >= threeMonthsAgo
      );
      if (recentPayments.length === 0) return 30;
      if (recentPayments.length >= 2) return 100;
      return 60;
    });
    const consistencyScore = consistencyScores.reduce((a, b) => a + b, 0) / consistencyScores.length;

    const debtCountScore =
      debts.length === 0 ? 100 : debts.length <= 3 ? 100 : debts.length <= 6 ? 80 : Math.max(30, 80 - (debts.length - 6) * 10);

    debtHealthScore = Math.round(0.4 * dtiScore + 0.3 * progressScore + 0.2 * consistencyScore + 0.1 * debtCountScore);
  }

  // Budget summary
  let budgetSummary;
  if (budgetDoc) {
    const allocations = toNumberRecord(budgetDoc.allocations || {});
    console.log(`📊 Budget allocations:`, Object.keys(allocations).length, "categories");
    console.log(`📊 Category totals:`, Object.keys(categoryTotals).length, "categories", Object.keys(categoryTotals));
    const categoriesSet = new Set([...Object.keys(allocations), ...Object.keys(categoryTotals)]);
    const budgetCategories = [...categoriesSet].map((category) => {
      const budgeted = round2(allocations[category] || 0);
      const actual = round2(categoryTotals[category] || 0);
      const variance = round2(actual - budgeted);
      const varianceRate = budgeted > 0 ? variance / budgeted : null;
      return {
        category,
        budgeted,
        actual,
        variance,
        varianceRate: varianceRate !== null ? round4(varianceRate) : null,
      };
    });
    const totalBudget = round2(budgetCategories.reduce((sum, cat) => sum + cat.budgeted, 0));
    const totalActual = round2(budgetCategories.reduce((sum, cat) => sum + cat.actual, 0));
    console.log(`📊 Budget summary: totalBudget=${totalBudget}, totalActual=${totalActual}, categories=${budgetCategories.length}`);
    budgetSummary = {
      totalBudget,
      totalActual,
      categories: budgetCategories,
    };
  }

  const snapshot = {
    userId,
    monthKey,
    currency: "MYR",
    // NOTE: totalExpenses includes consumption + savings contributions to preserve legacy fields.
    totalIncome: round2(totalIncome),
    totalExpenses,
    savings,
    savingsRate: round4(legacySavingsRate),
    categories,
  };

  if (debtHealthScore !== null) snapshot.debtHealthScore = debtHealthScore;
  if (debts.length > 0) {
    snapshot.totalDebt = round2(totalDebtVal);
    snapshot.monthlyDebtPayments = round2(monthlyDebtPaymentsVal);
  }

  snapshot.spendingTotals = spendingTotals;
  snapshot.savingsSummary = savingsSummary;
  if (debtSummary) snapshot.debtSummary = debtSummary;
  if (budgetSummary) snapshot.budgetSummary = budgetSummary;

  return snapshot;
}

// ======================================================
// 📊 Monthly Snapshot Endpoint
// ======================================================
app.get("/monthly-snapshot", async (req, res) => {
  try {
    const { userId, monthKey: monthKeyQuery } = req.query;
    if (!userId) {
      return res.status(400).json({ error: "Missing userId query parameter" });
    }
    // TODO: userId should come from verified auth middleware, not directly from req.query.

    const targetMonthKey =
      typeof monthKeyQuery === "string" && monthKeyQuery.length > 0
        ? monthKeyQuery
        : getCurrentMonthKey();

    console.log("[/monthly-snapshot] userId, monthKey:", userId, targetMonthKey);

    const snapshot = await buildMonthlySnapshotFromFirestore(userId, targetMonthKey);
    const snapshotStats = snapshot
      ? {
          userId,
          monthKey: targetMonthKey,
          income: snapshot.totalIncome,
          spending: snapshot.spendingTotals?.spending,
          savings: snapshot.savingsSummary?.savingsContrib,
          dti: snapshot.debtSummary?.debtToIncomeRatio,
        }
      : { userId, monthKey: targetMonthKey, snapshot: null };

    if (isDevEnv) {
      console.log("[/monthly-snapshot] snapshot:", JSON.stringify(snapshot, null, 2));
    } else {
      console.log("[/monthly-snapshot] snapshot stats:", snapshotStats);
    }

    res.json({ snapshot: snapshot ?? null });
  } catch (err) {
    console.error("❌ Monthly snapshot error:", err.message);
    console.error("❌ Full error:", err);
    res.json({ snapshot: null });
  }
});

// ======================================================
// 💰 Transaction Creation Helpers (reused by chat)
// ======================================================
const SAVINGS_CATEGORY_NAMES_BACKEND = ["Savings", "Saving", "Emergency Fund", "Emergency", "Investments", "Investment"];

// ======================================================
// 📋 Pending Transaction Storage (in-memory)
// ======================================================
// NOTE: In production, consider moving this to Firestore or Redis to survive server restarts
// and handle multiple server instances. For now, in-memory Map is acceptable for single-instance deployments.
const pendingTransactions = new Map(); // userId -> transactionData

function setPendingTransaction(userId, transactionData) {
  pendingTransactions.set(userId, {
    ...transactionData,
    createdAt: Date.now(), // Track when pending was created (for potential timeout)
  });
  console.log(`📋 Pending transaction set for userId: ${userId}`);
}

function getPendingTransaction(userId) {
  return pendingTransactions.get(userId);
}

function clearPendingTransaction(userId) {
  const existed = pendingTransactions.delete(userId);
  if (existed) {
    console.log(`🗑️ Pending transaction cleared for userId: ${userId}`);
  }
  return existed;
}

// Helper to check if user message means "confirm"
function isConfirmMessage(message) {
  const lower = message.toLowerCase().trim();
  const confirmPatterns = [
    /^confirm$/,
    /^yes$/,
    /^ok$/,
    /^okay$/,
    /^save$/,
    /^save it$/,
    /^go ahead$/,
    /^proceed$/,
    /^do it$/,
    /^sure$/,
    /^yep$/,
    /^yeah$/,
    /^correct$/,
    /^that's right$/,
    /^that is right$/,
  ];
  return confirmPatterns.some(pattern => pattern.test(lower));
}

// Helper to check if user message means "cancel"
function isCancelMessage(message) {
  const lower = message.toLowerCase().trim();
  const cancelPatterns = [
    /^cancel$/,
    /^no$/,
    /^don't save$/,
    /^dont save$/,
    /^discard$/,
    /^ignore$/,
    /^nevermind$/,
    /^never mind$/,
    /^forget it$/,
    /^nope$/,
    /^nah$/,
  ];
  return cancelPatterns.some(pattern => pattern.test(lower));
}

// Helper to format transaction summary for confirmation prompt (internal use)
function formatTransactionSummary(transactionData) {
  const { type, amount, currency = "MYR", date, categoryId, description, paymentMethod } = transactionData;
  
  // Format date
  let dateStr = "today";
  if (date) {
    try {
      const dateObj = new Date(date);
      dateStr = dateObj.toLocaleDateString("en-US", { 
        year: "numeric", 
        month: "short", 
        day: "numeric" 
      });
    } catch {
      dateStr = "today";
    }
  }
  
  // Determine category (use provided or infer from description)
  const category = categoryId || mapCategoryToExisting(description || "", type);
  
  // Build summary
  const typeLabel = type === "expense" ? "Expense" : "Income";
  const summary = `I'm about to log this transaction:

• Type: ${typeLabel}
• Amount: ${currency} ${amount}
• Category: ${category}
• Date: ${dateStr}
${description ? `• Description: ${description}` : ""}
${paymentMethod ? `• Payment Method: ${paymentMethod}` : ""}

Type **confirm** to save it, or **cancel** to discard.`;

  return summary;
}

// Helper to format transaction data for structured API response
function formatTransactionForResponse(transactionData) {
  const { type, amount, currency = "MYR", date, categoryId, description, paymentMethod } = transactionData;
  
  // Format date as ISO string (YYYY-MM-DD) or "today"
  let dateStr = null;
  if (date) {
    try {
      const dateObj = new Date(date);
      dateStr = dateObj.toISOString().split("T")[0]; // YYYY-MM-DD format
    } catch {
      dateStr = null;
    }
  }
  
  // Determine category name (use provided or infer from description)
  const categoryName = categoryId || mapCategoryToExisting(description || "", type);
  
  return {
    type: type, // "expense" | "income"
    amount: parseFloat(amount),
    currency: currency,
    categoryName: categoryName,
    date: dateStr,
    description: description || "",
    paymentMethod: paymentMethod || (type === "expense" ? "Cash" : "Bank"),
  };
}

// Map natural language descriptions to existing categories
function mapCategoryToExisting(description = "", type = "expense") {
  const lower = (description || "").toLowerCase();
  
  if (type === "expense") {
    // Expense categories from AddRecord.tsx
    if (lower.match(/rice|fish|chicken|tomato|egg|drink|tea|cabbage|meal|food|mee|lunch|dinner|breakfast|restaurant|mcd|kfc|starbucks|cafe|coffee/)) return "Food";
    if (lower.match(/grab|taxi|bus|fuel|toll|train|car|transport|uber|parking/)) return "Transport";
    if (lower.match(/supermarket|grocer|mart|tesco|jaya|aeon|lotus|grocery|shopping|store/)) return "Shopping";
    if (lower.match(/hotel|flight|travel|booking|trip|vacation/)) return "Travel";
    if (lower.match(/movie|cinema|ticket|entertainment|game|netflix|spotify/)) return "Entertainment";
    if (lower.match(/electric|water|bill|utility|tenaga|tm|unifi|internet|wifi|phone|mobile/)) return "Bills";
    if (lower.match(/pharmacy|clinic|hospital|health|medical|doctor|medicine/)) return "Healthcare";
    if (lower.match(/education|school|university|college|tuition|book/)) return "Education";
    if (lower.match(/rent|housing|home|apartment|house/)) return "Housing";
    return "Others";
  } else {
    // Income categories from AddRecord.tsx
    if (lower.match(/salary|pay|wage|employment|job|work/)) return "Salary";
    if (lower.match(/investment|dividend|stock|return/)) return "Investment";
    if (lower.match(/gift|present|bonus/)) return "Gift";
    if (lower.match(/freelance|contract|project|consulting/)) return "Freelance";
    if (lower.match(/bonus|incentive/)) return "Bonus";
    return "Salary"; // Default for income
  }
}

// Create expense record (same schema as AddRecord.tsx)
async function createExpenseRecord(userId, { amount, currency = "MYR", date, categoryId, description, paymentMethod = "Cash" }) {
  if (!db) {
    throw new Error("Firestore not initialized");
  }
  
  const userPath = normalizeUserPath(userId);
  const expId = "EXP" + new Date().getTime();
  
  // Map category if provided, otherwise try to infer from description
  let finalCategory = categoryId || mapCategoryToExisting(description, "expense");
  
  // Validate date or default to today
  let finalDate;
  try {
    finalDate = date ? new Date(date).toISOString() : new Date().toISOString();
  } catch {
    finalDate = new Date().toISOString();
  }
  
  const expenseData = {
    exp_id: expId,
    user_id: userPath,
    exp_category: finalCategory,
    exp_payment_method: paymentMethod,
    exp_total: parseFloat(amount),
    exp_notes: description || "",
    exp_date: finalDate,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  const docRef = await db.collection("EXPENSES").add(expenseData);
  return { id: docRef.id, ...expenseData };
}

// Create income record (same schema as AddRecord.tsx)
async function createIncomeRecord(userId, { amount, currency = "MYR", date, categoryId, description, paymentMethod = "Bank" }) {
  if (!db) {
    throw new Error("Firestore not initialized");
  }
  
  const userPath = normalizeUserPath(userId);
  const incId = "INC" + new Date().getTime();
  
  // Map category if provided, otherwise try to infer from description
  let finalCategory = categoryId || mapCategoryToExisting(description, "income");
  
  // Validate date or default to today
  let finalDate;
  try {
    finalDate = date ? new Date(date).toISOString() : new Date().toISOString();
  } catch {
    finalDate = new Date().toISOString();
  }
  
  const incomeData = {
    inc_id: incId,
    user_id: userPath,
    inc_category: finalCategory,
    inc_payment_method: paymentMethod,
    inc_total: parseFloat(amount),
    inc_notes: description || "",
    inc_date: finalDate,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  const docRef = await db.collection("INCOME").add(incomeData);
  return { id: docRef.id, ...incomeData };
}

// ======================================================
// 🤖 Chatbot route (OpenAI with finance snapshot)
// ======================================================
const CHAT_SYSTEM_PROMPT = `You are Auri, a direct but kind personal finance coach. 
You ONLY use the numeric data in the JSON 'snapshot' when talking about money.
If the snapshot is null or missing information, say so and give general advice instead.
Never invent MYR amounts or percentages that are not directly implied by the snapshot.
All amounts are in MYR.

IMPORTANT FINANCIAL CONCEPTS:
- "spending" or "consumption spending" refers to spendingTotals.spending (consumption only, excludes savings contributions)
- "savings contributions" refers to spendingTotals.savingsContrib (money actively saved this month)
- When discussing spending behavior, use spendingTotals.spending, NOT totalExpenses
- When discussing savings rate, prefer savingsSummary.savingsRate if available (based on actual contributions), otherwise use the top-level savingsRate
- For loan questions, consider both debtSummary (debt obligations) and savingsSummary (available savings/assets)
- If snapshot.totalIncome <= 0, do NOT compute savingsRate or debt-to-income ratios. Explain that meaningful ratios cannot be computed.
- If budgetSummary.totalBudget is 0 or every category has a 0 budget, do NOT comment about overspending vs budget because there is no budget baseline.

TRANSACTION LOGGING:
- When the user CLEARLY asks to log/add/record/save an expense or income (e.g., "Add an expense", "Log my salary", "I paid RM 120"), call the create_transaction tool.
- If the user is just TALKING about money without asking to log it (e.g., "I hate paying RM 100 for parking"), do NOT create a transaction.
- Only call create_transaction when the user explicitly intends to record a transaction.
- If critical fields are missing (amount, type, or unclear date), ask a clarifying question before calling the tool.
- IMPORTANT: When proposing a new transaction using the create_transaction tool, you are only suggesting the data. The system will show a confirmation card with buttons. Do NOT say that a transaction has already been saved. Use language like "I'm about to log this transaction" and let the system handle the actual save after user confirmation via buttons.`;

// OpenAI function/tool definition for create_transaction
const CREATE_TRANSACTION_TOOL = {
  type: "function",
  function: {
    name: "create_transaction",
    description: "Create a new expense or income transaction record. Use this when the user explicitly asks to log/add/record/save an expense or income.",
    parameters: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["expense", "income"],
          description: "Whether this is an expense or income transaction",
        },
        amount: {
          type: "number",
          description: "The transaction amount (positive number)",
        },
        currency: {
          type: "string",
          description: "Currency code (default: MYR if not specified)",
          default: "MYR",
        },
        date: {
          type: "string",
          description: "Transaction date in ISO format (YYYY-MM-DD or full ISO string). Default to today if not specified or unclear.",
        },
        categoryId: {
          type: "string",
          description: "Category name (e.g., 'Food', 'Transport', 'Salary'). If not provided, will be inferred from description. For expenses: Food, Transport, Housing, Shopping, Bills, Entertainment, Healthcare, Education, Others. For income: Salary, Investment, Gift, Freelance, Bonus.",
        },
        description: {
          type: "string",
          description: "Description or merchant name for the transaction",
        },
        paymentMethod: {
          type: "string",
          description: "Payment method (e.g., 'Cash', 'Bank', 'Credit Card'). Default: 'Cash' for expenses, 'Bank' for income.",
        },
      },
      required: ["type", "amount"],
    },
  },
};

// ======================================================
// 🤖 Chat Endpoint with Button-Based Transaction Confirmation
// ======================================================
// 
// NEW BUTTON-BASED FLOW:
// 
// 1. User sends text message: "Add an expense RM 50 for groceries"
//    → Backend calls OpenAI with create_transaction tool
//    → Model extracts transaction data and calls tool
//    → Backend stores as pending transaction (no DB write yet)
//    → Returns: { type: "pending_transaction_confirmation", message: "...", transaction: {...}, actions: [...] }
// 
// 2. Frontend displays confirmation card with "Confirm" and "Cancel" buttons
// 
// 3. User clicks "Confirm" button
//    → Frontend sends: { userId, action: "confirm_pending_transaction" }
//    → Backend saves transaction to Firestore
//    → Clears pending transaction
//    → Returns: { type: "normal", message: "Done! I've saved..." }
// 
// 4. User clicks "Cancel" button
//    → Frontend sends: { userId, action: "cancel_pending_transaction" }
//    → Backend clears pending transaction (no DB write)
//    → Returns: { type: "normal", message: "Okay, I've discarded..." }
// 
// 5. If user sends text while pending exists (fallback):
//    → If text matches confirm/cancel patterns → process as above
//    → Otherwise → return pending confirmation structure again with buttons
// 
// 6. Normal chat (no pending transaction):
//    → Returns: { type: "normal", message: "Assistant reply..." }
// 
// ======================================================
app.post("/chat", async (req, res) => {
  console.log("📨 /chat endpoint called");
  try {
    const { message, userId, action } = req.body || {};
    console.log("📨 /chat request:", { 
      hasMessage: !!message, 
      hasUserId: !!userId, 
      hasAction: !!action,
      messagePreview: message ? message.substring(0, 50) : null 
    });
    
    // Validate request: must have either message or action, and always need userId
    if (!userId) {
      console.error("❌ /chat: Missing userId");
      return res.status(400).json({ error: "Missing userId" });
    }
    if (!message && !action) {
      console.error("❌ /chat: Missing both message and action");
      return res.status(400).json({ error: "Must provide either 'message' or 'action'" });
    }
    // TODO: userId should come from verified auth middleware, not directly from req.body.

    if (!openai) {
      return res.status(500).json({ error: "OpenAI API key not configured" });
    }

    // ======================================================
    // STEP 1: Handle button actions (confirm/cancel from UI)
    // ======================================================
    if (action) {
      const pending = getPendingTransaction(userId);
      
      if (action === "confirm_pending_transaction") {
        if (!pending) {
          return res.json({
            type: "normal",
            message: "There is no transaction pending confirmation.",
          });
        }
        
        // User confirmed via button - save the transaction
        try {
          let createdRecord;
          if (pending.type === "expense") {
            createdRecord = await createExpenseRecord(userId, {
              amount: pending.amount,
              currency: pending.currency || "MYR",
              date: pending.date,
              categoryId: pending.categoryId,
              description: pending.description || "",
              paymentMethod: pending.paymentMethod || "Cash",
            });
          } else {
            createdRecord = await createIncomeRecord(userId, {
              amount: pending.amount,
              currency: pending.currency || "MYR",
              date: pending.date,
              categoryId: pending.categoryId,
              description: pending.description || "",
              paymentMethod: pending.paymentMethod || "Bank",
            });
          }
          
          console.log("✅ Transaction confirmed and saved:", createdRecord);
          clearPendingTransaction(userId);
          
          // Format date for display
          const transactionDate = new Date(createdRecord.exp_date || createdRecord.inc_date);
          const dateStr = transactionDate.toLocaleDateString("en-US", { 
            year: "numeric", 
            month: "short", 
            day: "numeric" 
          });
          
          const confirmationMessage = `Done! I've saved this transaction:
• Type: ${pending.type === "expense" ? "Expense" : "Income"}
• Amount: ${pending.currency || "MYR"} ${pending.amount}
• Category: ${createdRecord.exp_category || createdRecord.inc_category}
${createdRecord.exp_notes || createdRecord.inc_notes ? `• Description: ${createdRecord.exp_notes || createdRecord.inc_notes}` : ""}
• Date: ${dateStr}`;
          
          return res.json({
            type: "normal",
            message: confirmationMessage,
          });
        } catch (error) {
          console.error("❌ Error saving confirmed transaction:", error);
          clearPendingTransaction(userId);
          return res.json({
            type: "normal",
            message: `Sorry, I encountered an error while saving the transaction: ${error.message}. Please try again or use the manual Add Record screen.`,
          });
        }
      } else if (action === "cancel_pending_transaction") {
        if (!pending) {
          return res.json({
            type: "normal",
            message: "There is no transaction pending confirmation.",
          });
        }
        
        // User cancelled via button - discard pending transaction
        clearPendingTransaction(userId);
        return res.json({
          type: "normal",
          message: "Okay, I've discarded that transaction and nothing was saved.",
        });
      } else {
        // Unknown action
        return res.json({
          type: "normal",
          message: "Unknown action. Please try again.",
        });
      }
    }

    // ======================================================
    // STEP 2: Handle text messages when pending transaction exists
    // ======================================================
    const pending = getPendingTransaction(userId);
    if (pending) {
      console.log("📋 Found pending transaction for userId:", userId);
      
      // Optional: Keep text-based confirm/cancel as fallback
      if (isConfirmMessage(message)) {
        // User confirmed via text - save the transaction
        try {
          let createdRecord;
          if (pending.type === "expense") {
            createdRecord = await createExpenseRecord(userId, {
              amount: pending.amount,
              currency: pending.currency || "MYR",
              date: pending.date,
              categoryId: pending.categoryId,
              description: pending.description || "",
              paymentMethod: pending.paymentMethod || "Cash",
            });
          } else {
            createdRecord = await createIncomeRecord(userId, {
              amount: pending.amount,
              currency: pending.currency || "MYR",
              date: pending.date,
              categoryId: pending.categoryId,
              description: pending.description || "",
              paymentMethod: pending.paymentMethod || "Bank",
            });
          }
          
          console.log("✅ Transaction confirmed and saved:", createdRecord);
          clearPendingTransaction(userId);
          
          const transactionDate = new Date(createdRecord.exp_date || createdRecord.inc_date);
          const dateStr = transactionDate.toLocaleDateString("en-US", { 
            year: "numeric", 
            month: "short", 
            day: "numeric" 
          });
          
          const confirmationMessage = `Done! I've saved this transaction:
• Type: ${pending.type === "expense" ? "Expense" : "Income"}
• Amount: ${pending.currency || "MYR"} ${pending.amount}
• Category: ${createdRecord.exp_category || createdRecord.inc_category}
${createdRecord.exp_notes || createdRecord.inc_notes ? `• Description: ${createdRecord.exp_notes || createdRecord.inc_notes}` : ""}
• Date: ${dateStr}`;
          
          return res.json({
            type: "normal",
            message: confirmationMessage,
          });
        } catch (error) {
          console.error("❌ Error saving confirmed transaction:", error);
          clearPendingTransaction(userId);
          return res.json({
            type: "normal",
            message: `Sorry, I encountered an error while saving the transaction: ${error.message}. Please try again or use the manual Add Record screen.`,
          });
        }
      } else if (isCancelMessage(message)) {
        // User cancelled via text - discard pending transaction
        clearPendingTransaction(userId);
        return res.json({
          type: "normal",
          message: "Okay, I've discarded that transaction and nothing was saved.",
        });
      } else {
        // User sent something unrelated - return pending confirmation structure with buttons
        return res.json({
          type: "pending_transaction_confirmation",
          message: "You still have a pending transaction. Please confirm or cancel it.",
          transaction: formatTransactionForResponse(pending),
          actions: [
            { id: "confirm_pending_transaction", label: "Confirm", style: "primary" },
            { id: "cancel_pending_transaction", label: "Cancel", style: "secondary" },
          ],
        });
      }
    }

    // ======================================================
    // STEP 3: No pending transaction - proceed with normal chat flow
    // ======================================================
    const targetMonthKey = getCurrentMonthKey(); // Chat uses 3-month snapshot for better analysis

    // Try 3-month snapshot first with shorter timeout, fallback to single month if it fails
    let snapshot3Month = null;
    let fallbackSnapshot = null;
    
    // Load snapshots - try 3-month first, fallback to single month
    // Start both in parallel to maximize chance of getting 3-month data
    console.log(`📊 Loading snapshots for chat - userId: ${userId}, monthKey: ${targetMonthKey}`);
    
    // Start both snapshot loads in parallel
    // Use full snapshot (not fast) to get budget data for chat responses
    const singleMonthPromise = buildMonthlySnapshotFromFirestore(userId, targetMonthKey).catch(err => {
      console.warn("⏱️ Single-month snapshot error:", err.message);
      return null;
    });
    
    const threeMonthPromise = build3MonthSnapshot(userId).catch(err => {
      console.warn("⏱️ 3-month snapshot error:", err.message);
      return null;
    });
    
    // Wait for both with a timeout - use whichever completes successfully
    // Use longer timeout to allow 3-month snapshot to complete (it needs 3 snapshots × up to 6 seconds each)
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Snapshot timeout")), 10000); // 10 second timeout for 3-month snapshot
      });
      
      // Wait for both to complete or timeout
      const results = await Promise.race([
        Promise.all([singleMonthPromise, threeMonthPromise]),
        timeoutPromise
      ]);
      
      if (results && Array.isArray(results)) {
        const [singleResult, threeResult] = results;
        
        // Prefer 3-month snapshot if available (even if it has less than 3 months)
        // Use it if it has at least 1 month of data
        // BUT also keep the full snapshot for budget data if available
        if (threeResult && threeResult.months && Array.isArray(threeResult.months) && threeResult.months.length > 0) {
          snapshot3Month = threeResult;
          console.log("✅ 3-month snapshot loaded for chat:", {
            monthsCount: snapshot3Month.months.length,
            totalIncome: snapshot3Month.totals.totalIncome,
            totalSpending: snapshot3Month.totals.totalSpending,
            monthKeys: snapshot3Month.months.map(m => m.monthKey),
          });
          // If we have a full snapshot, use it for budget data even if we're using 3-month snapshot
          if (singleResult && singleResult.budgetSummary) {
            fallbackSnapshot = singleResult;
            console.log("✅ Using full snapshot for budget data:", {
              hasBudgetSummary: !!fallbackSnapshot.budgetSummary,
              totalBudget: fallbackSnapshot.budgetSummary?.totalBudget || 0,
            });
          }
        } else {
          // 3-month snapshot failed or returned empty - log details for debugging
          console.warn("⚠️ 3-month snapshot not available:", {
            hasResult: !!threeResult,
            resultType: threeResult ? typeof threeResult : 'null',
            hasMonths: !!(threeResult && threeResult.months),
            monthsType: threeResult?.months ? typeof threeResult.months : 'null',
            monthsLength: threeResult?.months?.length || 0,
            resultKeys: threeResult ? Object.keys(threeResult) : [],
          });
          
          // Fallback to single month snapshot
          if (singleResult) {
            fallbackSnapshot = singleResult;
            console.log("✅ Using single-month snapshot (3-month unavailable):", {
              income: fallbackSnapshot.totalIncome,
              spending: fallbackSnapshot.spendingTotals?.spending,
              hasBudgetSummary: !!fallbackSnapshot.budgetSummary,
              totalBudget: fallbackSnapshot.budgetSummary?.totalBudget || 0,
            });
          } else {
            console.warn("⚠️ Both snapshots returned null or empty");
            console.warn("⚠️ singleResult type:", typeof singleResult, "value:", singleResult);
          }
        }
      }
    } catch (timeoutErr) {
      // Timeout occurred - try to get at least single month snapshot
      console.warn("⏱️ Snapshot loading timed out, trying to get single month snapshot...");
      try {
        const quickTimeout = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Too slow")), 8000); // 8 second timeout to allow full snapshot to load
        });
        fallbackSnapshot = await Promise.race([singleMonthPromise, quickTimeout]);
        if (fallbackSnapshot) {
          console.log("✅ Got single-month snapshot after timeout:", {
            hasBudgetSummary: !!fallbackSnapshot.budgetSummary,
            totalBudget: fallbackSnapshot.budgetSummary?.totalBudget || 0,
          });
        } else {
          console.warn("⚠️ Single-month snapshot still null after timeout");
        }
      } catch (e) {
        console.warn("⏱️ Could not get snapshot in time");
      }
    }
    
    // Log final state
    if (!snapshot3Month && !fallbackSnapshot) {
      console.warn("⚠️ No snapshot data available - proceeding without financial data");
    }
    
    // Extract current month data for compatibility
    let income = 0;
    let spending = 0;
    
    if (snapshot3Month && snapshot3Month.months && snapshot3Month.months.length > 0) {
      // Use 3-month snapshot data
      const currentMonthData = snapshot3Month.months[0];
      income = currentMonthData.totalIncome || 0;
      spending = currentMonthData.totalSpending || 0;
    } else if (fallbackSnapshot) {
      // Use single month fallback snapshot
      income = fallbackSnapshot.totalIncome || 0;
      spending = fallbackSnapshot.spendingTotals?.spending || 0;
    }
    
    // Extract budget from snapshot if available
    let totalBudget = 0;
    if (fallbackSnapshot && fallbackSnapshot.budgetSummary && fallbackSnapshot.budgetSummary.totalBudget) {
      totalBudget = fallbackSnapshot.budgetSummary.totalBudget;
      console.log("✅ Extracted budget from snapshot:", totalBudget);
    } else {
      console.warn("⚠️ No budget data in fallbackSnapshot:", {
        hasFallbackSnapshot: !!fallbackSnapshot,
        hasBudgetSummary: !!(fallbackSnapshot && fallbackSnapshot.budgetSummary),
        totalBudget: fallbackSnapshot?.budgetSummary?.totalBudget,
      });
    }
    const hasMeaningfulBudget = totalBudget > 0;

    const snapshotStats = snapshot3Month
      ? {
          userId,
          monthKey: targetMonthKey,
          income3Month: snapshot3Month.totals.totalIncome,
          spending3Month: snapshot3Month.totals.totalSpending,
          avgMonthlyIncome: snapshot3Month.averages.monthlyIncome,
          avgMonthlySpending: snapshot3Month.averages.monthlySpending,
          monthsCount: snapshot3Month.months.length,
        }
      : fallbackSnapshot
      ? {
          userId,
          monthKey: targetMonthKey,
          income: fallbackSnapshot.totalIncome,
          spending: fallbackSnapshot.spendingTotals?.spending,
          totalBudget: fallbackSnapshot.budgetSummary?.totalBudget || 0,
          type: "single-month-fallback",
        }
      : { userId, monthKey: targetMonthKey, snapshot: null };
    console.log("🧾 /chat snapshot stats:", snapshotStats);

    const promptNotes = [];
    if (income <= 0) {
      promptNotes.push(
        "WARNING: totalIncome is 0 or negative. Do NOT compute savings rates or debt-to-income ratios. Explain clearly that meaningful ratios cannot be computed because income is 0 this month."
      );
    }
    if (Math.abs(income) < TINY_TOTAL_THRESHOLD && Math.abs(spending) < TINY_TOTAL_THRESHOLD) {
      promptNotes.push(
        "NOTE: This month has very small totals (income and spending under 50 MYR). Make it clear in your answer that insights are based on very little data and may not be representative."
      );
    }
    if (!hasMeaningfulBudget) {
      promptNotes.push(
        "NOTE: There is effectively no budget set (totalBudget is 0). Do NOT comment about overspending or underspending relative to a budget; instead, suggest setting up a budget first if helpful."
      );
    }

    // Build user content with improved prompt engineering for better analysis
    let userContent = "";
    
    // Add context notes if needed
    if (promptNotes.length) {
      userContent += "CONTEXT NOTES:\n" + promptNotes.join("\n") + "\n\n";
    }

    // Format snapshot data clearly for LLM analysis
    // Prefer 3-month snapshot, fallback to single month if available
    if (snapshot3Month && snapshot3Month.months && snapshot3Month.months.length > 0) {
      userContent += `FINANCIAL DATA FOR LAST 3 MONTHS:\n\n`;
      
      // Show data for each month
      snapshot3Month.months.forEach((monthData, index) => {
        const monthLabel = index === 0 ? "Current Month" : index === 1 ? "Previous Month" : "2 Months Ago";
        userContent += `${monthLabel} (${monthData.monthKey}):\n`;
        userContent += `  - Total Income: ${monthData.totalIncome} MYR\n`;
        userContent += `  - Total Spending: ${monthData.totalSpending} MYR\n`;
        userContent += `  - Net Cash Flow: ${monthData.netCashFlow} MYR\n`;
        userContent += `  - Expenses Count: ${monthData.expensesCount}\n`;
        userContent += `  - Income Records: ${monthData.incomesCount}\n`;
        
        if (Object.keys(monthData.categoryBreakdown).length > 0) {
          userContent += `  - Top Categories:\n`;
          const sortedCategories = Object.entries(monthData.categoryBreakdown)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5); // Top 5 categories per month
          sortedCategories.forEach(([cat, amount]) => {
            userContent += `    • ${cat}: ${amount} MYR\n`;
          });
        }
        userContent += `\n`;
      });
      
      // Show aggregated totals and averages
      userContent += `3-MONTH TOTALS:\n`;
      userContent += `  - Total Income (3 months): ${snapshot3Month.totals.totalIncome} MYR\n`;
      userContent += `  - Total Spending (3 months): ${snapshot3Month.totals.totalSpending} MYR\n`;
      userContent += `  - Total Net Cash Flow (3 months): ${snapshot3Month.totals.totalNetCashFlow} MYR\n`;
      userContent += `\n`;
      userContent += `3-MONTH AVERAGES:\n`;
      userContent += `  - Average Monthly Income: ${snapshot3Month.averages.monthlyIncome} MYR\n`;
      userContent += `  - Average Monthly Spending: ${snapshot3Month.averages.monthlySpending} MYR\n`;
      userContent += `  - Average Monthly Net Cash Flow: ${snapshot3Month.averages.monthlyNetCashFlow} MYR\n`;
      userContent += `\n`;
      
      // Show aggregated category breakdown
      if (snapshot3Month.categoryBreakdown && Object.keys(snapshot3Month.categoryBreakdown).length > 0) {
        userContent += `SPENDING BY CATEGORY (3-MONTH TOTAL):\n`;
        const sortedCategories = Object.entries(snapshot3Month.categoryBreakdown)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10); // Top 10 categories
        sortedCategories.forEach(([cat, amount]) => {
          userContent += `  - ${cat}: ${amount} MYR\n`;
        });
        userContent += `\n`;
      }
      
      userContent += `Note: This snapshot includes the last 3 months of financial data for better historical analysis.\n`;
      userContent += `Use this data to identify trends, patterns, and provide informed financial recommendations.\n\n`;
    } else if (fallbackSnapshot) {
      // Fallback to single month snapshot format
      userContent += `FINANCIAL DATA FOR CURRENT MONTH (${targetMonthKey}):\n`;
      userContent += `Total Income: ${fallbackSnapshot.totalIncome} MYR\n`;
      userContent += `Total Spending (consumption): ${fallbackSnapshot.spendingTotals?.spending || 0} MYR\n`;
      userContent += `Net Cash Flow: ${fallbackSnapshot.spendingTotals?.netCashFlow || 0} MYR\n`;
      userContent += `Number of Expenses: ${fallbackSnapshot.expensesCount || 0}\n`;
      userContent += `Number of Income Records: ${fallbackSnapshot.incomesCount || 0}\n`;
      
      if (fallbackSnapshot.categoryBreakdown && Object.keys(fallbackSnapshot.categoryBreakdown).length > 0) {
        userContent += `\nSPENDING BY CATEGORY:\n`;
        const sortedCategories = Object.entries(fallbackSnapshot.categoryBreakdown)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10); // Top 10 categories
        sortedCategories.forEach(([cat, amount]) => {
          userContent += `  - ${cat}: ${amount} MYR\n`;
        });
      }
      
      // Include budget information if available
      if (fallbackSnapshot.budgetSummary && fallbackSnapshot.budgetSummary.totalBudget > 0) {
        userContent += `\nBUDGET STATUS:\n`;
        userContent += `  - Total Budget: ${fallbackSnapshot.budgetSummary.totalBudget} MYR\n`;
        userContent += `  - Total Actual Spending: ${fallbackSnapshot.budgetSummary.totalActual} MYR\n`;
        const budgetRemaining = fallbackSnapshot.budgetSummary.totalBudget - fallbackSnapshot.budgetSummary.totalActual;
        userContent += `  - Budget Remaining: ${budgetRemaining} MYR\n`;
        const budgetUsedPct = fallbackSnapshot.budgetSummary.totalBudget > 0 
          ? (fallbackSnapshot.budgetSummary.totalActual / fallbackSnapshot.budgetSummary.totalBudget) * 100 
          : 0;
        userContent += `  - Budget Utilization: ${budgetUsedPct.toFixed(1)}%\n`;
        
        if (fallbackSnapshot.budgetSummary.categories && fallbackSnapshot.budgetSummary.categories.length > 0) {
          userContent += `  - Budget by Category:\n`;
          fallbackSnapshot.budgetSummary.categories.forEach((cat) => {
            if (cat.budgeted > 0) {
              userContent += `    • ${cat.category}: Budgeted ${cat.budgeted} MYR, Actual ${cat.actual} MYR`;
              if (cat.variance !== null && cat.variance !== undefined) {
                userContent += `, ${cat.variance >= 0 ? 'over' : 'under'} by ${Math.abs(cat.variance).toFixed(2)} MYR`;
              }
              userContent += `\n`;
            }
          });
        }
      }
      
      userContent += `\nNote: This is current month data only. Historical trend analysis is not available.\n\n`;
    } else {
      // Even if snapshots failed, try to provide basic guidance
      userContent += "FINANCIAL DATA: Unable to load detailed snapshot data at this time.\n";
      userContent += "This may happen with large datasets or network issues.\n";
      userContent += "Please try asking your question again, or check your internet connection.\n";
      userContent += "You can also view your financial data directly in the app's dashboard.\n\n";
    }

    // Improved prompt with clear instructions using prompt engineering techniques
    userContent += `USER QUESTION: "${message}"\n\n`;
    userContent += `ANALYSIS INSTRUCTIONS (follow these carefully):\n`;
    userContent += `1. DATA-DRIVEN ANALYSIS: Use ONLY the financial data provided above. Never invent or estimate numbers.\n`;
    userContent += `2. HISTORICAL CONTEXT: You have access to 3 months of financial data. Use this to:\n`;
    userContent += `   - Identify trends (e.g., is spending increasing/decreasing month-over-month?)\n`;
    userContent += `   - Assess financial stability (consistent income and spending patterns)\n`;
    userContent += `   - Calculate averages for more reliable assessments\n`;
    userContent += `   - Compare current month to previous months to spot changes\n`;
    userContent += `3. SPENDING ANALYSIS: When analyzing spending behavior:\n`;
    userContent += `   - Use monthly averages for more reliable assessments (not just current month)\n`;
    userContent += `   - Analyze category breakdown across all 3 months to identify consistent patterns\n`;
    userContent += `   - Compare spending trends month-over-month\n`;
    userContent += `   - Compare average spending to average income to assess financial health\n`;
    userContent += `4. INCOME ANALYSIS: Reference both current month and 3-month averages when discussing earnings.\n`;
    userContent += `   - Use average monthly income for loan affordability calculations\n`;
    userContent += `   - Note if income is stable, increasing, or decreasing over the 3 months\n`;
    userContent += `5. ACTIONABLE INSIGHTS: Provide specific, actionable recommendations based on the actual data shown.\n`;
    userContent += `6. DATA LIMITATIONS: If data is missing or limited, acknowledge this clearly and provide general guidance.\n`;
    userContent += `7. RESPONSE FORMAT: Keep responses clear, concise, and focused. Provide 2-3 key insights with actionable recommendations.\n`;
    userContent += `8. TONE: Be helpful, supportive, and direct. Use the actual numbers from the data to build credibility.\n`;

    const lower = message.toLowerCase();
    const asksNewLoan =
      lower.includes("apply for") ||
      lower.includes("get a loan") ||
      lower.includes("take a loan") ||
      lower.includes("house loan") ||
      lower.includes("car loan") ||
      lower.includes("personal loan") ||
      lower.includes("new mortgage") ||
      lower.includes("new loan") ||
      lower.includes("should i get a loan") ||
      lower.includes("should i take a loan");

    if (asksNewLoan) {
      userContent +=
        "\n\nThe user is asking about taking a NEW loan. Use the 3-month financial data to assess their readiness:\n" +
        "- Calculate debt-to-income ratio using AVERAGE monthly income (not just current month) for more reliable assessment.\n" +
        "- Analyze spending trends: Is spending consistent, increasing, or decreasing over the 3 months?\n" +
        "- Assess cash flow stability: Is net cash flow positive consistently across all 3 months?\n" +
        "- Look at spending patterns: Are there any concerning trends (e.g., spending increasing faster than income)?\n" +
        "- Calculate affordability: Can they afford the new loan payment based on their average monthly net cash flow?\n" +
        "- Consider financial stability: Have they maintained positive cash flow for at least 2-3 months?\n" +
        "- Explain why taking a new loan looks manageable or risky based on these 3-month trends.\n" +
        "- Suggest improvements before taking a loan (e.g., reduce spending, build emergency fund, stabilize income).\n" +
        "- Do NOT give guarantees; this is not formal financial advice.\n" +
        "- IMPORTANT: Use the 3-month averages and trends, not just the current month, for a more accurate assessment.\n";
    }

    // First API call with tools (with timeout to prevent hanging)
    let response;
    try {
      const openaiPromise = openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: CHAT_SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        tools: [CREATE_TRANSACTION_TOOL],
        tool_choice: "auto", // Let the model decide when to use the tool
        max_tokens: 500,
        temperature: 0.7,
      });
      
      // Add 15 second timeout to OpenAI API call
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("OpenAI API timeout")), 15000);
      });
      
      response = await Promise.race([openaiPromise, timeoutPromise]);
    } catch (err) {
      console.error("❌ OpenAI API call failed:", err.message);
      // Return a helpful error message instead of failing completely
      return res.json({
        type: "normal",
        message: "I'm having trouble processing your request right now. This might be due to a slow connection or API timeout. Please try again in a moment.",
      });
    }

    const assistantMessage = response.choices[0]?.message;
    let finalReply = assistantMessage?.content || "";

    // Check if the model wants to call a tool
    if (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolCall = assistantMessage.tool_calls[0];
      
      if (toolCall.function.name === "create_transaction") {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          console.log("🔧 Tool call received:", args);

          // Validate required fields
          if (!args.type || !args.amount) {
            finalReply = "I need both the transaction type (expense or income) and amount to create a record. Could you please provide those?";
          } else {
            // Store as pending transaction instead of immediately saving
            // NOTE: For now, we require confirmation for ALL transactions.
            // In the future, we could relax this for small amounts (e.g., < 100 MYR),
            // but always require confirmation for large amounts (>= 1000 MYR).
            const requiresConfirmation = true; // Set to false for auto-save on small amounts in future
            
            if (requiresConfirmation || args.amount >= 1000) {
              // Store pending transaction
              const transactionData = {
                type: args.type,
                amount: args.amount,
                currency: args.currency || "MYR",
                date: args.date,
                categoryId: args.categoryId,
                description: args.description || "",
                paymentMethod: args.paymentMethod || (args.type === "expense" ? "Cash" : "Bank"),
              };
              
              setPendingTransaction(userId, transactionData);
              
              console.log("📋 Transaction stored as pending, waiting for user confirmation");
              
              // Return structured pending confirmation response with buttons
              return res.json({
                type: "pending_transaction_confirmation",
                message: "I'm about to log this transaction:",
                transaction: formatTransactionForResponse(transactionData),
                actions: [
                  { id: "confirm_pending_transaction", label: "Confirm", style: "primary" },
                  { id: "cancel_pending_transaction", label: "Cancel", style: "secondary" },
                ],
              });
            } else {
              // Future: Auto-save for small amounts (not implemented yet)
              // For now, this branch won't execute since requiresConfirmation is always true
              finalReply = "Auto-save for small amounts is not yet implemented. All transactions require confirmation.";
            }
          }
        } catch (error) {
          console.error("❌ Error processing transaction tool call:", error);
          finalReply = `Sorry, I encountered an error while processing the transaction: ${error.message}. Please try again or use the manual Add Record screen.`;
        }
      }
    }

    // Return normal chat response (no pending transaction, no tool call, or tool call failed)
    res.json({
      type: "normal",
      message: finalReply,
    });
  } catch (err) {
    console.error("❌ Chat error:", err.response?.data || err.message);
    // Return a valid ChatResponse structure even on errors
    res.status(500).json({
      type: "normal",
      message: err.message || "Sorry, I encountered an error. Please try again.",
    });
  }
});

// ======================================================
// 💰 AI Spending Analysis route (OpenAI direct)
// ======================================================
const SYSTEM_PROMPT = `You are a cautious personal finance coach. You ONLY use the numeric data in the JSON 'snapshot' field. If a number is missing, say that it is missing. NEVER invent MYR amounts, percentages, or trends that are not directly present in the snapshot.

IMPORTANT: Use spendingTotals.spending (consumption spending) when analyzing spending behavior, NOT totalExpenses (which may include savings).
- If snapshot.totalIncome <= 0, do NOT compute savingsRate or debt-to-income ratios. Clearly state that the data is insufficient instead.
- If budgetSummary.totalBudget is 0 or every budgeted amount is 0, do NOT mention overspending relative to a budget because there is no baseline.

Your job:

1. Analyse their spending behaviour for that month:
   - Where is most of the money going? (use only the categories array from the snapshot, BUT exclude any "Savings" category from consumption analysis)
   - Which categories increased or decreased compared to last month? (use only changePctVsPrevMonth values from the snapshot)
   - Are they saving a healthy percentage? Use savingsSummary.savingsRate if available (based on actual contributions), otherwise use the top-level savingsRate.
   - If spendingTotals is available, note their consumption spending vs savings contributions separately.

2. Give 2–4 specific, realistic recommendations to improve their financial situation:
   - Focus on behaviour changes (for example: limits on a category, rules like "no food delivery on weekdays", or increasing savings contributions).
   - Use concrete numbers from the JSON where helpful (percentages, amounts).
   - If savingsSummary is available, reference their savings goals and progress.
   - If debtSummary is available, consider debt-to-income ratio and available savings when giving loan-related advice.
   - If totalIncome is 0 or very small, explain that you cannot meaningfully compute savings rate or deficits.

CRITICAL RULES:

- When discussing "spending", use spendingTotals.spending (consumption only), NOT totalExpenses.
- Savings contributions (spendingTotals.savingsContrib) are separate from consumption spending.
- You must not output any MYR amount or percentage that cannot be computed from the fields in the snapshot.
- If the snapshot looks inconsistent or has very small totals (e.g., totalIncome <= 0), comment on that instead of making up detailed insights.
- DO NOT invent numbers that are not present in the JSON.
- DO NOT recommend specific financial products, loans, investments, or brands.
- Do not talk about stocks, crypto, insurance products, or credit cards by name.
- It is okay to mention general concepts like "emergency fund", "high-interest debt", or "budgeting", but keep advice general.
- Do not promise outcomes or give legal/financial guarantees.
- Keep the total answer under 220 words.
- Use a friendly but direct tone, like a coach who wants the user to improve, not be comfortable.`;

app.post("/api/monthly-insights", async (req, res) => {
  try {
    if (!openai) {
      return res.status(500).json({ error: "OpenAI API key not configured" });
    }

    const { userId, monthKey: monthKeyBody } = req.body || {};
    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }
    // TODO: replace this userId from request with a verified uid from auth middleware.

    const targetMonthKey =
      typeof monthKeyBody === "string" && monthKeyBody.length > 0
        ? monthKeyBody
        : getCurrentMonthKey();

    const snapshot = await buildMonthlySnapshotFromFirestore(userId, targetMonthKey);
    if (!snapshot) {
      return res.status(400).json({ error: "Unable to build snapshot for analysis" });
    }

    const income = snapshot.totalIncome || 0;
    const spending = snapshot.spendingTotals?.spending ?? 0;
    const totalBudget = snapshot.budgetSummary?.totalBudget ?? 0;
    const hasMeaningfulBudget = totalBudget > 0;

    const promptNotes = [];
    if (income <= 0) {
      promptNotes.push(
        "WARNING: totalIncome is 0 or negative. Do NOT compute savings rates or debt-to-income ratios. Explain clearly that meaningful ratios cannot be computed because income is 0 this month."
      );
    }

    if (Math.abs(income) < TINY_TOTAL_THRESHOLD && Math.abs(spending) < TINY_TOTAL_THRESHOLD) {
      promptNotes.push(
        "NOTE: This month has very small totals (income and spending under 50 MYR). Make it clear that insights are based on very little data and may not be representative."
      );
    }

    if (!hasMeaningfulBudget) {
      promptNotes.push(
        "There is effectively no budget set (totalBudget is 0). Do NOT comment about overspending or underspending relative to a budget; instead, suggest setting up a budget first if helpful."
      );
    }

    const reminder =
      "Remember: You must not output any MYR amount or percentage that cannot be computed from the fields in the snapshot. " +
      "If income is 0, say so instead of trying to compute savingsRate or DTI. If the snapshot looks inconsistent or has very small totals, comment on that instead of making up detailed insights.";

    const noteBlock = promptNotes.length ? promptNotes.join("\n") + "\n\n" : "";
    const userPrompt = `${noteBlock}MonthlySnapshot JSON:\n${JSON.stringify(
      snapshot,
      null,
      2
    )}\n\n${reminder}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    const insightsText = response.choices[0]?.message?.content || "Unable to generate insights.";

    res.json({ insights: insightsText });
  } catch (err) {
    console.error("❌ OpenAI error:", err.response?.data || err.message);
    res.status(500).json({ error: err.message || "Failed to generate insights" });
  }
});

// ======================================================
// 📧 Email Verification Endpoints
// ======================================================

/**
 * POST /api/email/send-verification
 * Send verification email to user
 */
app.post("/api/email/send-verification", async (req, res) => {
  try {
    const { email, userId, username } = req.body;

    if (!email || !userId) {
      return res.status(400).json({ error: "Email and userId are required" });
    }

    // Wait a bit for transporter initialization if needed
    if (!transporterInitialized) {
      // Wait up to 2 seconds for initialization
      let waited = 0;
      while (!transporterInitialized && waited < 2000) {
        await new Promise(resolve => setTimeout(resolve, 100));
        waited += 100;
      }
    }

    if (!transporter || !transporterInitialized) {
      return res.status(500).json({ 
        error: "Email service not configured",
        message: "Please wait a moment and try again, or check server logs" 
      });
    }

    // Use OTP instead of verification link
    const result = await sendOTPEmail(email, userId, username || "User");

    const response = { 
      success: true, 
      message: "OTP code sent successfully" 
    };

    // Include preview URL and OTP code if using test email (for testing purposes)
    if (USE_TEST_EMAIL && result) {
      if (result.previewURL) {
        response.previewURL = result.previewURL;
      }
      if (result.otpCode) {
        response.otpCode = result.otpCode; // Only in test mode for debugging
      }
      response.testMode = true;
      console.log("📧 Test email preview URL:", result.previewURL);
    }

    res.json(response);
  } catch (error) {
    console.error("❌ Error sending verification email:", error);
    console.error("   Error details:", error.stack);
    res.status(500).json({ 
      error: "Failed to send verification email",
      message: error.message,
      details: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
  }
});

/**
 * POST /api/email/verify-otp
 * Verify OTP code
 */
app.post("/api/email/verify-otp", async (req, res) => {
  try {
    const { userId, otpCode } = req.body;

    if (!userId || !otpCode) {
      return res.status(400).json({ error: "UserId and OTP code are required" });
    }

    const otpData = otpStore.get(userId);

    if (!otpData) {
      return res.status(400).json({ 
        error: "OTP not found or expired. Please request a new code." 
      });
    }

    // Check if expired
    if (new Date() > otpData.expiresAt) {
      otpStore.delete(userId);
      return res.status(400).json({ 
        error: "OTP code has expired. Please request a new code." 
      });
    }

    // Check attempts (max 5 attempts)
    if (otpData.attempts >= 5) {
      otpStore.delete(userId);
      return res.status(400).json({ 
        error: "Too many failed attempts. Please request a new code." 
      });
    }

    // Verify OTP code
    if (otpCode !== otpData.code) {
      otpData.attempts = (otpData.attempts || 0) + 1;
      otpStore.set(userId, otpData);
      return res.status(400).json({ 
        error: "Invalid OTP code",
        attemptsRemaining: 5 - otpData.attempts
      });
    }

    // OTP verified successfully - mark email as verified in Firestore
    if (db) {
      try {
        await db.collection("USERS").doc(userId).update({
          emailVerified: true,
          emailVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Delete OTP after successful verification
        otpStore.delete(userId);

        res.json({ 
          success: true, 
          message: "Email verified successfully",
          userId: userId 
        });
      } catch (firestoreError) {
        console.error("❌ Error updating Firestore:", firestoreError);
        res.status(500).json({ 
          error: "OTP valid but failed to update user record",
          message: firestoreError.message 
        });
      }
    } else {
      // If Firestore is not available, just verify the OTP
      otpStore.delete(userId);
      res.json({ 
        success: true, 
        message: "OTP verified successfully (Firestore update skipped)",
        userId: userId 
      });
    }
  } catch (error) {
    console.error("❌ Error verifying OTP:", error);
    res.status(500).json({ 
      error: "Failed to verify OTP",
      message: error.message 
    });
  }
});

/**
 * POST /api/email/resend-otp
 * Resend OTP code
 */
app.post("/api/email/resend-otp", async (req, res) => {
  try {
    const { email, userId, username } = req.body;

    if (!email || !userId) {
      return res.status(400).json({ error: "Email and userId are required" });
    }

    // Wait a bit for transporter initialization if needed
    if (!transporterInitialized) {
      let waited = 0;
      while (!transporterInitialized && waited < 2000) {
        await new Promise(resolve => setTimeout(resolve, 100));
        waited += 100;
      }
    }

    if (!transporter || !transporterInitialized) {
      return res.status(500).json({ error: "Email service not configured" });
    }

    // Check if user already verified
    if (db) {
      try {
        const userDoc = await db.collection("USERS").doc(userId).get();
        if (userDoc.exists() && userDoc.data().emailVerified) {
          return res.status(400).json({ 
            error: "Email is already verified" 
          });
        }
      } catch (firestoreError) {
        console.warn("⚠️ Could not check verification status:", firestoreError);
        // Continue anyway
      }
    }

    const result = await sendOTPEmail(email, userId, username || "User");

    const response = { 
      success: true, 
      message: "OTP code resent successfully" 
    };

    // Include preview URL and OTP code if using test email
    if (USE_TEST_EMAIL && result) {
      if (result.previewURL) {
        response.previewURL = result.previewURL;
      }
      if (result.otpCode) {
        response.otpCode = result.otpCode; // Only in test mode for debugging
      }
      response.testMode = true;
    }

    res.json(response);
  } catch (error) {
    console.error("❌ Error resending OTP:", error);
    res.status(500).json({ 
      error: "Failed to resend OTP",
      message: error.message 
    });
  }
});

// ======================================================
// 🔐 Password Reset Endpoints (OTP-based)
// ======================================================

/**
 * POST /api/auth/request-password-reset
 * Start password reset flow: look up user by email, generate OTP, send email
 * Body: { email }
 * Response (on success): { success: true, userId, username, testMode?, otpCode?, previewURL? }
 */
app.post("/api/auth/request-password-reset", async (req, res) => {
  try {
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    if (!db) {
      return res.status(500).json({ error: "Firestore not initialized on backend" });
    }

    // Find user document by email (same field used in Register screen)
    const snap = await db
      .collection("USERS")
      .where("user_email", "==", email)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({
        error: "No account found with that email address",
      });
    }

    const userDoc = snap.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data() || {};
    const username = userData.username || "User";

    // Ensure email transporter is ready (similar to send-verification)
    if (!transporterInitialized) {
      let waited = 0;
      while (!transporterInitialized && waited < 2000) {
        // wait up to 2 seconds
        await new Promise((resolve) => setTimeout(resolve, 100));
        waited += 100;
      }
    }

    if (!transporter || !transporterInitialized) {
      return res.status(500).json({
        error: "Email service not configured",
        message: "Please wait a moment and try again, or check server logs",
      });
    }

    // Reuse the same OTP email helper, but semantically for password reset
    const result = await sendOTPEmail(email, userId, username);

    const response = {
      success: true,
      message: "Password reset code sent successfully",
      userId,
      username,
    };

    // Include preview URL and OTP code in test mode
    if (USE_TEST_EMAIL && result) {
      if (result.previewURL) {
        response.previewURL = result.previewURL;
      }
      if (result.otpCode) {
        response.otpCode = result.otpCode;
      }
      response.testMode = true;
    }

    res.json(response);
  } catch (error) {
    console.error("❌ Error requesting password reset:", error);
    res.status(500).json({
      success: false,
      error: "Failed to start password reset process",
      message: error.message,
    });
  }
});

/**
 * POST /api/auth/verify-reset-otp
 * Verify OTP code specifically for password reset (does NOT change emailVerified)
 * Body: { userId, otpCode, email }
 */
app.post("/api/auth/verify-reset-otp", async (req, res) => {
  try {
    const { userId, otpCode } = req.body || {};

    if (!userId || !otpCode) {
      return res.status(400).json({ error: "UserId and OTP code are required" });
    }

    const otpData = otpStore.get(userId);

    if (!otpData) {
      return res.status(400).json({
        error: "OTP not found or expired. Please request a new code.",
      });
    }

    // Check if expired
    if (new Date() > otpData.expiresAt) {
      otpStore.delete(userId);
      return res.status(400).json({
        error: "OTP code has expired. Please request a new code.",
      });
    }

    // Check attempts (max 5 attempts)
    if (otpData.attempts >= 5) {
      otpStore.delete(userId);
      return res.status(400).json({
        error: "Too many failed attempts. Please request a new code.",
      });
    }

    // Verify OTP code
    if (otpCode !== otpData.code) {
      otpData.attempts = (otpData.attempts || 0) + 1;
      otpStore.set(userId, otpData);
      return res.status(400).json({
        error: "Invalid OTP code",
        attemptsRemaining: 5 - otpData.attempts,
      });
    }

    // OTP verified successfully for password reset
    otpStore.delete(userId);

    return res.json({
      success: true,
      message: "OTP verified successfully for password reset",
      userId,
    });
  } catch (error) {
    console.error("❌ Error verifying reset OTP:", error);
    res.status(500).json({
      error: "Failed to verify OTP for password reset",
      message: error.message,
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Actually update the user's password after OTP verification
 * Body: { email, userId, newPassword }
 */
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { email, userId, newPassword } = req.body || {};

    if (!userId || !newPassword) {
      return res.status(400).json({
        error: "UserId and newPassword are required",
      });
    }

    // Enforce same strength rule as frontend (Register / ResetPassword)
    const strongPassword =
      typeof newPassword === "string" &&
      newPassword.length >= 8 &&
      /[A-Z]/.test(newPassword) &&
      /[a-z]/.test(newPassword) &&
      /\d/.test(newPassword);

    if (!strongPassword) {
      return res.status(400).json({
        error:
          "Password must be at least 8 characters long and include upper, lower case letters and a number.",
      });
    }

    // Check against previous password (if stored in USERS doc)
    if (db) {
      try {
        const userDoc = await db.collection("USERS").doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data() || {};
          const prevPassword = userData.user_password;
          if (typeof prevPassword === "string" && prevPassword === newPassword) {
            return res.status(400).json({
              error: "New password cannot be the same as your previous password.",
            });
          }
        }
      } catch (checkError) {
        console.warn(
          "⚠️ Could not check previous password before reset:",
          checkError
        );
        // Continue anyway; not critical enough to fail the whole request
      }
    }

    // Update Firebase Auth password if admin is available
    try {
      if (admin && admin.auth) {
        await admin.auth().updateUser(userId, { password: newPassword });
      } else {
        console.warn("⚠️ Firebase Admin Auth not available. Skipping auth password update.");
      }
    } catch (authError) {
      console.error("❌ Error updating Firebase Auth password:", authError);
      return res.status(500).json({
        error: "Failed to update authentication password",
        message: authError.message,
      });
    }

    // Optionally update Firestore user document's stored password field for consistency
    if (db) {
      try {
        const userRef = db.collection("USERS").doc(userId);
        const updatePayload = {
          user_password: newPassword,
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        };

        // If email is provided, we can ensure it still matches
        if (email) {
          updatePayload.user_email = email;
        }

        await userRef.update(updatePayload);
      } catch (firestoreError) {
        console.error("⚠️ Password updated in Auth but failed to update Firestore:", firestoreError);
        // Don't fail the whole request if Firestore update fails after auth success
      }
    }

    return res.json({
      success: true,
      message: "Password has been reset successfully",
      userId,
    });
  } catch (error) {
    console.error("❌ Error in /api/auth/reset-password:", error);
    res.status(500).json({
      error: "Failed to reset password",
      message: error.message,
    });
  }
});

// ======================================================
// 🚀 Start server
// ======================================================
const PORT = process.env.PORT || 3000;

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    services: {
      openai: openai ? "configured" : "not configured",
      firestore: db ? "configured" : "not configured",
    }
  });
});

// Listen on all interfaces (0.0.0.0) so it's accessible from other devices on the network
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Backend running on http://0.0.0.0:${PORT}`);
  console.log(`✅ Accessible from network at http://192.168.0.97:${PORT}`);
  console.log(`✅ Health check: http://localhost:${PORT}/health`);
});
