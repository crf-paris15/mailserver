import express from "express";
import Twilio from "twilio";

export const validateTwilioRequest = (req: express.Request) => {
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  const twilioSignature = req.get("x-twilio-signature") || "";
  const body = req.body;

  return Twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN || "",
    twilioSignature,
    (process.env.URL || "") + req.originalUrl,
    body,
  );
};

export const endTwilioResponse = (
  res: express.Response,
  response: Twilio.twiml.VoiceResponse,
) => {
  res.status(200);
  res.set("Content-Type", "text/xml");
  res.send(response.toString());
};
