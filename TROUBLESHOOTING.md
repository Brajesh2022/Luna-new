# Luna AI - Troubleshooting Guide

## Issue: "Luna is connecting" and nothing happens

### Quick Steps to Debug:

1. **Test the API directly:**
   - Look for the "Test API" button in the top header
   - Click it to test if the Gemini API is working
   - Check the console for any error messages

2. **Check the Browser Console:**
   - Open Developer Tools (F12)
   - Go to the Console tab
   - Look for error messages with emojis like ❌ or 🚀
   - Share any error messages you see

3. **Check Network Tab:**
   - In Developer Tools, go to Network tab
   - Try sending a message
   - Look for failed requests (red entries)
   - Check the response of `/api/conversations/*/messages/stream`

### Common Issues and Solutions:

#### 1. API Key Issues
**Symptoms:** Error messages about "API key failed" or "All API keys failed"

**Solutions:**
- Check if the API keys are valid and active
- Verify the API keys have proper permissions
- Check if you've exceeded the quota for all keys

#### 2. Network Issues
**Symptoms:** Connection timeout or network errors

**Solutions:**
- Check your internet connection
- Try refreshing the page
- Clear browser cache

#### 3. CORS Issues
**Symptoms:** CORS errors in console

**Solutions:**
- This is a server-side issue
- Check if the server is running properly
- Restart the development server

#### 4. Streaming Issues
**Symptoms:** "connecting" but no response

**Solutions:**
- The system will automatically fall back to regular API calls
- Check console for "Streaming failed, falling back to regular API"
- If fallback also fails, there's likely an API key issue

### Debug Console Messages:

Look for these specific messages in the console:

**Good messages:**
- 🚀 generateChatResponse called
- 📡 Making request with API key fallback...
- ✅ Successfully used API key 1
- ✅ Response received, status: 200

**Warning messages:**
- ⚠️ Retryable error with API key 1, trying next key...
- Streaming failed, falling back to regular API

**Error messages:**
- ❌ All 4 API keys failed
- ❌ Gemini API error details
- ❌ Invalid response structure

### Testing Steps:

1. **Test API Keys:**
   ```
   Click "Test API" button → Should show success toast
   ```

2. **Test Message Sending:**
   ```
   Type "Hello" → Send → Should get response
   ```

3. **Check API Status:**
   ```
   Click status indicator (bottom right) → Should show key status
   ```

### If Still Not Working:

1. **Check Server Logs:**
   - Look at the terminal where you ran `npm run dev`
   - Check for any error messages there

2. **Verify API Keys:**
   - Make sure all 4 API keys are correct
   - Test one API key manually at https://generativelanguage.googleapis.com/

3. **Restart Everything:**
   ```bash
   # Kill the dev server
   pkill -f "next dev"
   
   # Restart
   npm run dev
   ```

### Emergency Fallback:

If streaming continues to fail, the system includes these fallbacks:
1. **Primary:** Streaming API with real-time typing
2. **Fallback 1:** Regular API with simulated typing
3. **Fallback 2:** Regular API without typing animation

### Getting Help:

When reporting issues, please include:
1. Browser console errors
2. Network tab responses
3. Server terminal output
4. Which API test results you got

### API Key Status Meanings:

- **Green (Active):** API key is working correctly
- **Red (Failed):** API key has failed (rate limit, quota, etc.)
- **Gray (Unknown):** API key hasn't been tested yet

### Performance Tips:

- The system tries keys in order (1→2→3→4)
- Failed keys are skipped until the next restart
- 500ms delay between key retries to avoid rate limiting