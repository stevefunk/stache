[i guess bro](https://stache-production.up.railway.app)

# Stache

**Stache that file.**

Stache is a tiny web app for uploading a file through indexd to Sia's decentralized storage network, then sharing it with a browser-viewable link.

## MVP flow

1. Visit the homepage.
2. Drop a file into the big upload box.
3. Click **Stache It**.
4. Watch the file get a mustache disguise while uploading.
5. Copy the share link.
6. Open the link to preview or download the file.

## Local development

```bash
npm install
npm run dev
```

## indexd wiring

The upload/download calls are isolated in:

```txt
src/lib/indexdClient.ts
```

Right now that file includes a local browser mock so the UI works immediately. Replace the mock implementation with the real `@siafoundation/indexd-js` or `@siafoundation/indexd-react` calls when your indexd endpoint/config is ready.
