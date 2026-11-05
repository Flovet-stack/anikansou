const config = {
  "*.{js,mjs,ts,tsx,mts}": [
    "eslint --fix --max-warnings=0 --no-warn-ignored",
    "prettier --write",
  ],
  "*.{json,md,css,yml,yaml}": "prettier --write",
};

export default config;
