#!/bin/bash
# setup.sh — Download large model weights and WASM files not stored in git
# Run this once after cloning: bash setup.sh

set -e

echo "📦 Installing npm dependencies..."
npm install

echo "🧠 Downloading ONNX model weights and WASM runtime..."
# These are excluded from git because they are 400MB+ in total.
# They are fetched from Hugging Face and npm on first build.
# Alternatively, run the extension once in Chrome — transformers.js
# will auto-download and cache them in IndexedDB from the CDN.

echo ""
echo "✅ Setup complete. Now build the extension:"
echo "   npm run build"
echo ""
echo "🚀 Start the server:"
echo "   cd server && npx tsx src/index.ts"
echo ""
echo "📝 Don't forget to create server/.env:"
echo "   GROQ_API_KEY=gsk_your_key_here"
echo "   GROQ_MODEL=qwen/qwen3.8-27b"
echo "   REASONING_PROVIDER=groq"
