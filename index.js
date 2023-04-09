const express = require("express");
const app = express();

import { collectData } from "./scrapperService";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Get a full listing
app.get("/data", async () => {
  try {
    const items = await collectData();
    res.json(items).end();
  } catch (e) {
    console.error(e);
  }
});

// Catch all handler for all other request.
app.use("*", (req, res) => {
  res.json({ msg: "no route handler found" }).end();
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`index.js listening on ${port}`);
});
