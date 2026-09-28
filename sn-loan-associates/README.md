# SN Loan Associates – Website

## Folder
- public/index.html  -> website (frontend)
- api/enquiry.js     -> backend: sends each enquiry to 93457 93807
- vercel.json, package.json, .env.example

## Deploy on Vercel
1. Upload this folder to a GitHub repo (or run `npx vercel` inside it).
2. vercel.com -> Add New -> Project -> import repo -> Deploy.
3. Settings -> Environment Variables:
   - NOTIFY_NUMBER = 9345793807
   - FAST2SMS_KEY  = your Fast2SMS API key
   - (optional) WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_TEMPLATE
4. Deployments -> Redeploy. Submit one test enquiry.
5. If nothing arrives: Vercel -> project -> Logs. Every enquiry is logged as "NEW ENQUIRY".

If the notification fails, the website opens WhatsApp with the details filled in, so no enquiry is lost.

## Before going live
- Replace YOUR-DOMAIN.com in index.html, robots.txt, sitemap.xml
- Replace office address and email in the footer
- Add Google Analytics (G-XXXXXXXXXX) and Search Console tag (marked in <head>)
- Search Console: add domain -> verify -> submit /sitemap.xml
