import Twilio from "twilio";
import "dotenv/config";
import express from "express";
import { endTwilioResponse, validateTwilioRequest } from "./helpers.ts";

const VOICE_PARAMS = {
  language: "fr-FR",
  voice: "Google.fr-FR-Chirp3-HD-Aoede",
} as const;

const LOCK_CRF_HOSTNAME = process.env.LOCK_CRF_HOSTNAME || "";
const API_SECRET = process.env.API_SECRET || "";

const app = express();
app.use(express.urlencoded({ extended: true }));

// Handle incoming calls
app.post("/", async (req, res) => {
  if (!validateTwilioRequest(req)) {
    return res.status(403).send("Forbidden");
  }

  const body = req.body;

  if (body === undefined) {
    const response = new Twilio.twiml.VoiceResponse();
    response.say(
      VOICE_PARAMS,
      "Désolé, une erreur interne s'est produite (code erreur 5). Contactez votre responsable d'activité pour actionner la serrure. Au revoir.",
    );
    response.hangup();
    endTwilioResponse(res, response);
  }

  const from = body.From || "unknown";
  const to = body.To || "unknown";

  const formData = new FormData();
  formData.append("from", from);
  formData.append("to", to);
  formData.append("apiSecret", API_SECRET);

  const response = new Twilio.twiml.VoiceResponse();

  fetch(`${LOCK_CRF_HOSTNAME}/api/phone`, {
    method: "POST",
    body: formData,
  }).then((r) =>
    r
      .json()
      .then((data: any) => {
        if (data.success) {
          response.gather({
            input: ["dtmf"],
            numDigits: 1,
            timeout: 2,
            actionOnEmptyResult: false,
            action: "/action",
            method: "POST",
          });

          response.say(VOICE_PARAMS, "Bienvenue");
          response.redirect({ method: "POST" }, "/ask");

          endTwilioResponse(res, response);
        } else {
          response.say(VOICE_PARAMS, data.error.message + " Au revoir.");
          response.hangup();
          endTwilioResponse(res, response);
        }
      })
      .catch(() => {
        response.say(
          VOICE_PARAMS,
          "Désolé, une erreur interne s'est produite (code erreur 2). Contactez votre responsable d'activité pour actionner la serrure. Au revoir.",
        );
        response.hangup();
        endTwilioResponse(res, response);
      }),
  );
});

// Handle question
app.post("/ask", (req, res) => {
  if (!validateTwilioRequest(req)) {
    return res.status(403).send("Forbidden");
  }

  const response = new Twilio.twiml.VoiceResponse();
  response.say(
    VOICE_PARAMS,
    "Pour ouvrir la serrure, appuyez sur 1. Pour fermer la serrure, appuyez sur 2.",
  );

  response.gather({
    input: ["dtmf"],
    numDigits: 1,
    timeout: 5,
    actionOnEmptyResult: true,
    action: "/action",
    method: "POST",
  });

  endTwilioResponse(res, response);
});

// Handle gather action
app.post("/action", (req, res) => {
  if (!validateTwilioRequest(req)) {
    return res.status(403).send("Forbidden");
  }

  const body = req.body;
  const digits = body.Digits || "";

  const response = new Twilio.twiml.VoiceResponse();

  switch (digits) {
    case "1":
      response.say(VOICE_PARAMS, "Vous avez choisi l'option un.");
      response.redirect({ method: "POST" }, "/actionRequest?action=1");
      break;
    case "2":
      response.say(VOICE_PARAMS, "Vous avez choisi l'option deux.");
      response.redirect({ method: "POST" }, "/actionRequest?action=2");
      break;
    case "":
      response.say(VOICE_PARAMS, "Aucune entrée reçue.");
      response.redirect({ method: "POST" }, "/ask");
      break;
    case "9":
      response.say(VOICE_PARAMS, "Vous avez choisi l'option neuf.");
      response.redirect({ method: "POST" }, "/version");
      break;
    default:
      response.say(VOICE_PARAMS, "Option non reconnue. Au revoir.");
      response.hangup();
      break;
  }

  endTwilioResponse(res, response);
});

// Version endpoint
app.post("/version", (req, res) => {
  if (!validateTwilioRequest(req)) {
    return res.status(403).send("Forbidden");
  }

  const response = new Twilio.twiml.VoiceResponse();
  response.say(
    VOICE_PARAMS,
    `La version actuelle du service est la version ${process.env.GIT_TAG || "de développement"}. Au revoir.`,
  );
  response.hangup();
  endTwilioResponse(res, response);
});

// Request action endpoint
app.post("/actionRequest", (req, res) => {
  if (!validateTwilioRequest(req)) {
    return res.status(403).send("Forbidden");
  }

  const body = req.body;
  const from = body.From || "unknown";
  const to = body.To || "unknown";

  const action = req.query.action || req.query.actionLast;
  const lastTry = (req.query.actionLast ? true : false) || false;

  if (action === "1" || action === "2") {
    const formData = new FormData();
    formData.append("action", action);
    formData.append("apiSecret", API_SECRET);
    formData.append("from", from);
    formData.append("to", to);

    fetch(`${LOCK_CRF_HOSTNAME}/api/phone/action`, {
      method: "POST",
      body: formData,
    }).then((r) =>
      r.json().then((data: any) => {
        const response = new Twilio.twiml.VoiceResponse();

        if (data.success) {
          if (lastTry === false) {
            response.say(
              VOICE_PARAMS,
              "Ordre envoyé à la serrure, ne raccrochez pas.",
            );
            response.pause({ length: 2 });
            response.redirect(
              { method: "POST" },
              "/checkActionResult?requestId=" + data.request.id,
            );
          } else {
            response.say(
              VOICE_PARAMS,
              "Nouvel ordre envoyé à la serrure, ne raccrochez pas.",
            );
            response.pause({ length: 2 });
            response.redirect(
              { method: "POST" },
              "/checkActionResult?requestIdLast=" + data.request.id,
            );
          }
        } else {
          response.say(
            VOICE_PARAMS,
            "Désolé, une erreur interne s'est produite (code erreur 3). Contactez votre responsable d'activité pour actionner la serrure. Au revoir.",
          );
          response.hangup();
        }

        endTwilioResponse(res, response);
      }),
    );
  } else {
    const response = new Twilio.twiml.VoiceResponse();
    response.say(VOICE_PARAMS, "Action non reconnue. Au revoir.");
    response.hangup();
    endTwilioResponse(res, response);
  }
});

// Check action result endpoint
app.post("/checkActionResult", async (req, res) => {
  if (!validateTwilioRequest(req)) {
    return res.status(403).send("Forbidden");
  }

  const requestId = req.query.requestId || req.query.requestIdLast;
  const lastTry = (req.query.requestIdLast ? true : false) || false;
  const response = new Twilio.twiml.VoiceResponse();

  if (!requestId) {
    response.say(
      VOICE_PARAMS,
      "Désolé, une erreur interne s'est produite (code erreur 1). Contactez votre responsable d'activité pour actionner la serrure. Au revoir.",
    );
    response.hangup();
    endTwilioResponse(res, response);
  } else {
    const formData = new FormData();
    formData.append("apiSecret", API_SECRET);

    await fetch(`${LOCK_CRF_HOSTNAME}/api/requests/${requestId}`, {
      method: "POST",
      body: formData,
    })
      .then(
        async (r) =>
          await r.json().then((data: any) => {
            const response = new Twilio.twiml.VoiceResponse();

            if (data.success) {
              if (data.request.success === true) {
                response.say(
                  VOICE_PARAMS,
                  `La serrure a été ${data.request.action === 1 ? "déverrouillée" : "verrouillée"} avec succès. Au revoir.`,
                );
                response.hangup();
              } else if (
                data.request.error === "42" &&
                data.request.action === 2
              ) {
                if (lastTry === true) {
                  response.say(
                    VOICE_PARAMS,
                    "Erreur, le moteur est toujours bloqué. Veuillez contacter votre responsable d'activité pour actionner la serrure. Au revoir.",
                  );
                  response.hangup();
                } else {
                  response.say(
                    VOICE_PARAMS,
                    "Erreur, le moteur est bloqué. Vérifiez que la porte est bien poussée à fond. Nouvel essai de verrouillage dans 4 secondes.",
                  );
                  response.pause({ length: 4 });
                  response.redirect(
                    { method: "POST" },
                    `/actionRequest?actionLast=2`,
                  );
                }
              } else if (
                data.request.success === false &&
                data.request.error !== "42"
              ) {
                response.say(
                  VOICE_PARAMS,
                  "Erreur côté serrure. Veuillez contacter votre responsable d'activité pour actionner la serrure. Au revoir.",
                );
                response.hangup();
              } else if (data.request.success === null) {
                if (lastTry === true) {
                  response.say(
                    VOICE_PARAMS,
                    "Erreur, la serrure ne répond pas. Veuillez contacter votre responsable d'activité pour actionner la serrure. Au revoir.",
                  );
                  response.hangup();
                } else {
                  response.say(
                    VOICE_PARAMS,
                    "En attente de la réponse de la serrure, veuillez patienter.",
                  );
                  response.pause({ length: 3 });
                  response.redirect(
                    { method: "POST" },
                    `/checkActionResult?requestIdLast=${requestId}`,
                  );
                }
              }
            } else {
              response.say(
                VOICE_PARAMS,
                "Désolé, une erreur interne s'est produite (code erreur 4). Contactez votre responsable d'activité pour actionner la serrure. Au revoir.",
              );
              response.hangup();
            }

            endTwilioResponse(res, response);
          }),
      )
      .catch(() => {
        response.say(
          VOICE_PARAMS,
          "Désolé, une erreur interne s'est produite (code erreur 6). Contactez votre responsable d'activité pour actionner la serrure. Au revoir.",
        );
        response.hangup();
        endTwilioResponse(res, response);
      });
  }
});

// Health check endpoint
app.get("/health", (_, res) => {
  res.status(200).send("OK");
});

app.listen(process.env.PORT ? Number(process.env.PORT) : 3003);
