import assert from "node:assert/strict";
import test from "node:test";
import { inferFolderName, normalizeFolderName, resolveFolderForPayload } from "../src/folders.js";

test("inferFolderName prefers customer folder grouping from metadata", () => {
  assert.equal(inferFolderName({
    metadata: { customer: "REVOLVE", brand: "LIONESS" },
    product: {
      brand: "LIONESS",
      source_url: "https://www.revolve.com/lioness-stars-align-mini-dress/dp/LIOR-WD140/",
    },
  }), "REVOLVE");
});

test("inferFolderName falls back to merchant domain before product brand", () => {
  assert.equal(inferFolderName({
    product: {
      brand: "LIONESS",
      source_url: "https://www.revolve.com/lioness-stars-align-mini-dress/dp/LIOR-WD140/",
    },
  }), "revolve");
});

test("normalizeFolderName produces stable brand-style names", () => {
  assert.equal(normalizeFolderName("revolve"), "REVOLVE");
  assert.equal(normalizeFolderName("summer_drop"), "Summer DROP");
});

test("resolveFolderForPayload reuses an existing folder by normalized name", async () => {
  const calls = [];
  const client = {
    async listFolders() {
      calls.push("list");
      return { body: { folders: [{ folder_id: "636771263750078906", name: "REVOLVE" }] } };
    },
    async createFolder() {
      throw new Error("createFolder should not be called");
    },
  };

  const folder = await resolveFolderForPayload(client, {
    product: { source_url: "https://www.revolve.com/item" },
  }, {
    autoFolder: true,
  });

  assert.deepEqual(folder, {
    folderId: "636771263750078906",
    folderName: "REVOLVE",
    folderCreated: false,
    source: "existing-folder",
  });
  assert.deepEqual(calls, ["list"]);
});

test("resolveFolderForPayload creates a missing folder", async () => {
  const calls = [];
  const client = {
    async listFolders() {
      calls.push("list");
      return { body: { folders: [] } };
    },
    async createFolder(payload) {
      calls.push(["create", payload]);
      return { body: { folder_id: "636771263750078906" } };
    },
  };

  const folder = await resolveFolderForPayload(client, {
    metadata: { customer: "REVOLVE" },
    product: { source_url: "https://www.revolve.com/item" },
  }, {
    autoFolder: true,
  });

  assert.deepEqual(folder, {
    folderId: "636771263750078906",
    folderName: "REVOLVE",
    folderCreated: true,
    source: "created-folder",
  });
  assert.deepEqual(calls, ["list", ["create", { name: "REVOLVE" }]]);
});

test("resolveFolderForPayload keeps explicit folder ids as strings", async () => {
  const folder = await resolveFolderForPayload({}, {
    folder_id: "630251570268735431",
    product: { source_url: "https://www.revolve.com/item" },
  }, {});

  assert.equal(folder.folderId, "630251570268735431");
  assert.equal(folder.source, "explicit-folder-id");
});
