import express from "express";
import postmark from "postmark";

import { apiKeyAuth } from "./helpers.ts";
import * as MAIL_DATA from "./mail.json" with { type: "json" };

const SMTP_CLIENT = process.env.SMTP_CLIENT || "";
const CLIENT = new postmark.ServerClient(SMTP_CLIENT);

const app = express();
app.disable("x-powered-by");
app.use(express.urlencoded({ extended: true }));

app.post("/send-email", async (req: express.Request, res: express.Response) => {
  if (!apiKeyAuth(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = req.body;

  if (body === undefined) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const to = body.to || "unknown";

  try {
    await CLIENT.sendEmail({
      From: "benevolat.paris15@croix-rouge.fr",
      To: to,
      Subject: MAIL_DATA.default.Subject,
      HtmlBody: MAIL_DATA.default.HtmlBody,
      TextBody: MAIL_DATA.default.TextBody,
      MessageStream: "outbound",
    });
  } catch {
    return res.status(502).json({ error: "Unable to send email" });
  }

  return res.status(200).json({ message: "Email sent successfully" });
});

// Health check endpoint
app.get("/health", (_: express.Request, res: express.Response) => {
  res.status(200).send("OK");
});

app.listen(process.env.PORT ? Number(process.env.PORT) : 3003);
