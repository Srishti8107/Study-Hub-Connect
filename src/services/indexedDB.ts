import { openDB } from "idb";

export const dbPromise = openDB("LMSDatabase", 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains("videos")) {
      db.createObjectStore("videos", {
        keyPath: "videoId"
      });
    }
  },
});