import express from "express";

const API_KEY = process.env.API_KEY || "";

export const apiKeyAuth = (req: express.Request) => {
  const provided = req.header("x-api-key") || "";
  return provided === API_KEY;
};
