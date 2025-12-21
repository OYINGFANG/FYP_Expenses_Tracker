# Troubleshooting Guide - Backend Connection Issues

## 🔴 Problem: "Network request failed" or "Cannot connect to server"

This means your app cannot reach the backend server. Here's how to fix it:

## ✅ Solution Steps

### 1. **Check if Backend Server is Running**

Open a terminal in the `backend` folder and run:
```bash
cd backend
node server.js
```

You should see:
```
✅ Backend running on http://localhost:3000
✅ Firebase Admin initialized
✅ OpenAI initialized
```

**If you see errors:**
- Check if port 3000 is already in use
- Make sure you have a `.env` file with `OPENAI_API_KEY`
- Check if Firebase service account JSON file exists

### 2. **Verify IP Address**

The app is trying to connect to: `http://192.168.0.96:3000`

**To find your computer's IP address:**

**Windows:**
```bash
ipconfig
```
Look for "IPv4 Address" under your active network adapter (usually WiFi or Ethernet)

**Mac/Linux:**
```bash
ifconfig | grep "inet "
```
or
```bash
ip addr show
```

**Update the IP in these files:**
- `frontend/app/services/api.ts` - Line 15: `CHAT_SERVER_URL`
- `frontend/app/screen/Avatar.tsx` - Line 50: `YOUR_COMPUTER_IP`
- `frontend/app/screen/Home.tsx` - Check `CHAT_SERVER_URL` usage

### 3. **Network Requirements**

**For Real Device:**
- Your phone and computer must be on the **same WiFi network**
- Firewall must allow port 3000
- Some networks block device-to-device communication

**For Android Emulator:**
- Use `http://10.0.2.2:3000` instead of your IP

**For iOS Simulator:**
- Use `http://localhost:3000`

### 4. **Test Backend Connection**

Open a browser on your phone/emulator and go to:
```
http://192.168.0.96:3000/health
```
(You may need to add a health endpoint, or just try any endpoint)

If it doesn't load, the server isn't reachable.

### 5. **Firewall Settings**

**Windows Firewall:**
1. Open Windows Defender Firewall
2. Click "Allow an app through firewall"
3. Add Node.js or allow port 3000

**Mac Firewall:**
1. System Preferences → Security & Privacy → Firewall
2. Allow Node.js or disable firewall temporarily for testing

### 6. **Quick Fix: Use Localhost for Development**

If you're testing on the same machine, you can temporarily use:
- Android Emulator: `http://10.0.2.2:3000`
- iOS Simulator: `http://localhost:3000`

## 🔧 Common Issues

### Issue: "Port 3000 already in use"
**Solution:** Change the port in `backend/server.js`:
```javascript
const PORT = process.env.PORT || 3001; // Use 3001 instead
```
Then update frontend to use port 3001.

### Issue: "OPENAI_API_KEY not configured"
**Solution:** Create a `.env` file in the `backend` folder:
```
OPENAI_API_KEY=your-api-key-here
```

### Issue: "Firebase Admin initialization failed"
**Solution:** Make sure `auri-76581-firebase-adminsdk-fbsvc-1122c9b7d7.json` exists in the `backend` folder.

## 📝 Quick Checklist

- [ ] Backend server is running (`node server.js`)
- [ ] IP address is correct in frontend code
- [ ] Phone and computer are on same WiFi
- [ ] Firewall allows port 3000
- [ ] `.env` file exists with `OPENAI_API_KEY`
- [ ] Firebase service account JSON exists

## 🚀 After Fixing

Once the backend is running and reachable:
1. Restart your React Native app
2. Try the chatbot - it should connect
3. AI insights should work (may timeout with large datasets, but will show basic insights)




