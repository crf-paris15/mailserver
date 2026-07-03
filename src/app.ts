import "dotenv/config";
import express from "express";

const API_SECRET = process.env.API_SECRET || "";

const app = express();
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/health", (_: express.Request, res: express.Response) => {
  res.status(200).send("OK");
});

app.listen(process.env.PORT ? Number(process.env.PORT) : 3003);
