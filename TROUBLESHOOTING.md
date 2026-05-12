# Troubleshooting OpenAI API Integration

## Common Issues and Solutions

### 1. API Key Not Working

**Check 1: Verify .env.local file exists**
```bash
# In project root, create/check .env.local
cat .env.local
```

**Check 2: Verify the format is correct**
```
OPENAI_API_KEY=sk-...
```
- No quotes around the key
- No spaces around the `=`
- Key starts with `sk-`

**Check 3: Restart dev server**
After creating/updating `.env.local`, you MUST restart:
```bash
# Stop the server (Ctrl+C)
# Then restart
npm run dev
```

**Check 4: Verify in browser console**
Open browser DevTools (F12) → Console tab
- Should see: "✅ Claude API key loaded"
- If you see: "⚠️ Claude API key not found!" → Check steps above

### 2. API Errors

**Check browser console for errors:**
- 401 Unauthorized → Invalid API key
- 429 Too Many Requests → Rate limit, wait a bit
- 400 Bad Request → Check the request format

**Check terminal output:**
When you start `npm run dev`, you should see:
- Warning if API key is missing
- No warning if API key is found

### 3. Testing the API Key

You can test your API key directly:
```bash
curl https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### 4. Still Not Working?

1. **Clear browser cache** and hard refresh (Cmd+Shift+R)
2. **Check network tab** in DevTools for failed requests
3. **Verify API key** at https://platform.openai.com/api-keys
4. **Check API key permissions** - ensure it has access to the models you're using

