# Bible translation API and cache context

Recorded September 2, 2026 for Open Scripture (`apps/mobile` in `~/Projects/open-scripture`).

## Current decision

- Target translations are KJV, NASB, NIV, and ESV.
- Store the public-domain KJV permanently in Convex. Do not ship a second copy in the app.
- Use API.Bible for NASB and NIV.
- Use Crossway's separate ESV API for ESV. ESV is not available through API.Bible.
- Do not cache ESV Scripture on our server or in the app. Fetch it when requested through our server so the Crossway API key stays private.
- Treat the app as non-commercial only while it has no ads, subscriptions, in-app purchases, sponsorships, paid features, upsells, or other revenue.

## API.Bible context for NASB and NIV

- The non-commercial Starter plan allows up to three eligible copyrighted translations and 5,000 API requests per month.
- One outbound HTTP call to API.Bible counts as one request. A whole chapter can be one request.
- API.Bible explicitly permits shared server-side caching. Many users can receive the same cached chapter after one upstream request.
- Cached copyrighted content must be refreshed at least every 30 days. API.Bible recommends refreshing within 14 days.
- Scripture text and required attribution must remain unchanged.
- API credentials must remain on the server and must never ship in the mobile or web client.
- The server endpoint must only support this app. It must not become a public mirror or general-purpose Bible API.
- API.Bible asks that cached passages remain below 500 consecutive verses. Its current public terms do not impose a general 500-verses-total cache ceiling.
- Do not preload a complete NASB or NIV until the translation-specific agreement shown during API.Bible signup confirms that this is permitted.
- Remove cached copyrighted content promptly if API access or a translation license ends.

## Crossway ESV context

- Non-commercial API limits are 5,000 queries per day, 1,000 per hour, and 60 per minute.
- One uncached chapter lookup or search is normally one query.
- A query may contain at most 500 verses or half of a book, whichever is smaller, with stated exceptions for short books.
- The ordinary API terms permit caching no more than 500 ESV verses total and no more than half of any book.
- The project decision is simpler and more conservative: no ESV caching.
- Every ESV view will therefore cause an upstream request unless Crossway later grants broader written permission.
- ESV text must include the required attribution and must not be modified.
- The app includes Guzik commentary and Bible search. Ask Crossway to confirm in writing that this use is covered before release.

## App behavior

- KJV requires a connection to Convex, like the other translations.
- NASB and NIV can use a chapter-at-a-time shared server cache with a 14-day refresh and 30-day hard expiration.
- ESV requires a network connection and should show an explicit unavailable message if Crossway cannot be reached. Do not silently replace it with KJV.
- Strong's word interaction and existing LibriVox audio remain KJV-only.
- Exact search should use the selected translation's provider.
- Semantic search keeps its derived KJV vector index on-device, then fetches result text from Convex.
- Highlights, notes, reading plans, and commentary remain attached to canonical verse references so they carry across translations.
- Copy and share output must identify the selected translation.

## Unresolved choices

- Choose NASB 1995 or NASB 2020.
- Confirm the NIV edition and exact API.Bible translation IDs.
- Register API.Bible and Crossway applications and accept their current agreements.
- Decide whether to ship the web build. API.Bible requires its usage tracking for Scripture displayed on the web, including cache hits.
- Revisit all licenses before adding monetization, fundraising, or sponsorships.

Publisher agreements and current API terms control if they conflict with this working note.
