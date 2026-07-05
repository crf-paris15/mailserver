import express from "express";

const API_KEY = process.env.API_KEY || "";

export const apiKeyAuth = (req: express.Request) => {
  const provided = req.header("x-api-key") || "";
  return provided === API_KEY;
};

export const replacePlaceholders = (
  template: string,
  replacements: Record<string, string>,
) => {
  let result = template;

  for (const [placeholder, value] of Object.entries(replacements)) {
    const regex = new RegExp(`{{${placeholder}}}`, "g");
    result = result.replace(regex, value);
  }
  return result;
};
