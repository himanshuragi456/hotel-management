# Google Setup Checklist — Advanced Feedback System

## Step 1: Google Cloud Console

1. Go to https://console.cloud.google.com
2. Create a new project — name it **MagicManagement** (or anything you like)
3. Note your **Project ID** (shown under the project name)

---

## Step 2: Enable APIs

Inside your project, go to **APIs & Services → Library** and enable each of these:

- [ ] Google Business Profile API
- [ ] My Business Account Management API
- [ ] My Business Business Information API
- [ ] My Business Notifications API
- [ ] Cloud Pub/Sub API

---

## Step 3: OAuth 2.0 Credentials

Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**

- Application type: **Web application**
- Name: MagicManagement
- Authorized redirect URIs — add both:
  - `https://magicmanagement.dentask.in/api/auth/google/gmb/callback`
  - `http://localhost:8000/api/auth/google/gmb/callback` (for local testing)

After creating, you'll get:
- [ ] Copy **Client ID** → this is your `GOOGLE_CLIENT_ID`
- [ ] Copy **Client Secret** → this is your `GOOGLE_CLIENT_SECRET`

You'll also need to configure the **OAuth Consent Screen** (same sidebar):
- User type: **External**
- App name: MagicManagement
- Support email: your email
- Scopes: click **Add or Remove Scopes** and add:
  - `https://www.googleapis.com/auth/business.manage`
- Add yourself as a **Test User** while waiting for verification

---

## Step 4: Apply for Google Business Profile API Access

This is mandatory — without it, quota = 0 and all API calls fail.

1. Go to: https://developers.google.com/my-business/content/prereqs
2. Click **Request Access**
3. Fill in the form with:
   - **Use case:** "We are a SaaS platform that helps restaurants and hotels manage their Google Business Profile. We connect tenant accounts via OAuth to auto-fetch their location, display and auto-reply to reviews using AI, and publish GMB posts on their behalf with one click."
   - **Website:** https://magicmanagement.dentask.in
   - **Google account:** use an account that has an active GMB profile for 60+ days

Approval takes **3–10 business days**. You cannot go live until approved.

---

## Step 5: Cloud Pub/Sub Setup (for real-time review notifications)

Go to **Pub/Sub → Topics → Create Topic**

- Topic ID: `gmb-review-notifications`
- [ ] Note the full topic name: `projects/YOUR_PROJECT_ID/topics/gmb-review-notifications`

Then go to **Pub/Sub → Subscriptions → Create Subscription**

- Subscription ID: `gmb-review-push`
- Select the topic you just created
- Delivery type: **Push**
- Endpoint URL: `https://magicmanagement.dentask.in/api/webhooks/gmb-reviews`
- [ ] Note the subscription name

Then grant Google's internal account permission to publish to your topic:
- Go to the topic → **Permissions → Add Principal**
- Principal: `mybusiness-api-pubsub@system.gserviceaccount.com`
- Role: **Pub/Sub Publisher**

---

## Step 6: Service Account Key (for verifying Pub/Sub messages)

Go to **IAM & Admin → Service Accounts → Create Service Account**

- Name: `gmb-pubsub-subscriber`
- Role: **Pub/Sub Subscriber**

After creating, go to the service account → **Keys → Add Key → JSON**

- [ ] Download the JSON file — you'll share the contents with me to add to `.env`

---

## Keys to Share With Me When Ready

Once you've done the above, share these and I'll add them to `.env` and wire everything up:

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://magicmanagement.dentask.in/api/auth/google/gmb/callback
PUBSUB_TOPIC=projects/YOUR_PROJECT_ID/topics/gmb-review-notifications
PUBSUB_SUBSCRIPTION=projects/YOUR_PROJECT_ID/subscriptions/gmb-review-push
GOOGLE_SERVICE_ACCOUNT_JSON=<contents of the downloaded JSON key>
```

`OPENAI_API_KEY` is already set on the server — no action needed.

---

## Summary

| Step | What you get | Time |
|------|-------------|------|
| Create project + enable APIs | Project ready | 5 min |
| OAuth credentials | CLIENT_ID + CLIENT_SECRET | 5 min |
| API access request | Approval to use GMB API | 3–10 days |
| Pub/Sub topic + subscription | Real-time review hook | 10 min |
| Service account key | JSON key file | 5 min |
