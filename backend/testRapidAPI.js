require("dotenv").config();
const axios = require("axios");

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST;

async function testAI() {
  try {
    const response = await axios.post(
      `https://${RAPIDAPI_HOST}/aitohuman`,
      {
        text: "Explain the causes and effects of climate change in simple terms."
      },
      {
        headers: {
          "X-RapidAPI-Key": RAPIDAPI_KEY,
          "X-RapidAPI-Host": RAPIDAPI_HOST,
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    );

    console.log("✅ AI Response:", response.data);
  } catch (err) {
    console.error("❌ Error:", err.response?.data || err.message);
  }
}

// Run the test
testAI();
