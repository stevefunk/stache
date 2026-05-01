<img width="397" height="284" alt="1*FgFBTNtiPZuH_tg3wOQ4CQ" src="https://github.com/user-attachments/assets/19c165b8-0f6f-43d9-a736-efbac6c94561" />

https://stache-production.up.railway.app

looks like it exists, uploads, might use sia (i have no clue), and makes links. Viewing the file takes forever/doesn't work since for some reason it's coming from stachethatfile.com. If you apend the share link gibberish to the railway url it actually works but the site isn't doing that automatically.

everything below is whatever crap chatgpt wrote, and that was before i started getting into railway and got it up online or something. stachethatfile.com may also work at some point if the cname kicks in, i don't want that's all doing

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
