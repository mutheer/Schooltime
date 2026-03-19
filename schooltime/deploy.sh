#!/bin/bash
# SchoolTime — one-shot deploy to Netlify
# Run this from inside the schooltime/ folder

set -e

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building..."
npm run build

echo "🚀 Deploying to Netlify (site: schooltime-portal)..."
npx netlify-cli@latest deploy \
  --prod \
  --dir=dist \
  --site=78a91e21-b48f-469c-92c6-1f7ccdf3f410 \
  --auth=$(npx netlify-cli@latest env:get NETLIFY_AUTH_TOKEN 2>/dev/null || echo "")

echo ""
echo "✅ Done! Your app is live at:"
echo "   https://schooltime-portal.netlify.app"
echo ""
echo "🔐 HOD login credentials:"
echo "   Email:    hod@gpa.ac.bw"
echo "   Password: Admin@1234"
echo ""
echo "⚠️  Change the HOD password after first login via Supabase → Auth → Users"
