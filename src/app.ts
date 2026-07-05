import express from "express";
import postmark from "postmark";

import { apiKeyAuth, replacePlaceholders } from "./helpers.ts";
import fs from "node:fs";
import path from "node:path";

const SMTP_CLIENT = process.env.SMTP_CLIENT || "";
const CLIENT = new postmark.ServerClient(SMTP_CLIENT);
const EA_URL = "https://meetings.crf.tools/index.php/api/v1/";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const HTML = fs.readFileSync(path.resolve(__dirname, "mail.html"), "utf8");
const TEXT = fs.readFileSync(path.resolve(__dirname, "mail.txt"), "utf8");

const app = express();
app.disable("x-powered-by");
app.use(express.json());

app.get("/event", (req: express.Request, res: express.Response) => {
  console.log("GET /event", req.query);
  res.status(200).json({ message: "OK" });
});

app.post("/event", async (req: express.Request, res: express.Response) => {
  if (!apiKeyAuth(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.body === undefined) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const rawResponse = await fetch(
    EA_URL + "customers/" + req.body.payload.id_users_customer,
    {
      method: "GET",
      headers: {
        Authorization: "Bearer " + process.env.EA_API_KEY,
      },
    },
  );

  if ((await rawResponse.status) !== 200) {
    console.log(EA_URL + "customers/" + req.body.payload.id_users_customer);
    console.log("Error fetching customer data:", await rawResponse.text());
    return res.status(502).json({ error: "Unable to fetch customer data" });
  }

  const response = (await rawResponse.json()) as any;

  const date = new Date(req.body?.payload?.start_datetime).toLocaleDateString(
    "fr-FR",
  );
  const heure =
    new Date(req.body?.payload?.start_datetime)
      .getHours()
      .toString()
      .padStart(2, "0") +
    ":" +
    new Date(req.body?.payload?.start_datetime)
      .getMinutes()
      .toString()
      .padStart(2, "0");
  const id = req.body?.payload?.hash;

  try {
    await CLIENT.sendEmail({
      From: "benevolat.paris15@croix-rouge.fr",
      To: response?.email,
      Subject: "Bienvenue à la Croix-Rouge française de Paris 15 !",
      HtmlBody: replacePlaceholders(HTML, {
        name: response?.firstName,
        date: date,
        heure: heure,
        id: id,
      }),
      TextBody: replacePlaceholders(TEXT, {
        name: response?.firstName,
        date: date,
        heure: heure,
      }),
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
