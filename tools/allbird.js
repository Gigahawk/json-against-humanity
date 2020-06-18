const fs = require("fs");
const { google } = require("googleapis");
const { nanoid } = require("nanoid");
const {
  replace: { exoticChars: replaceExoticChars },
} = require("clean-text-utils");
const readline = require("readline");

// If modifying these scopes, delete token.json.
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = "token.json";

// Load client secrets from a local file.
fs.readFile("credentials.json", (err, content) => {
  if (err) return console.log("Error loading client secret file:", err);
  console.log("connecting to Google Sheets...");
  // Authorize a client with credentials, then call the Google Sheets API.
  authorize(JSON.parse(content), saveCardsToJSON);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });
  console.log("Authorize this app by visiting this url:", authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question("Enter the code from that page here: ", (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err)
        return console.error(
          "Error while trying to retrieve access token",
          err
        );
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log("Token stored to", TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

function normalizeName(name) {
  return name.replace("CAH :", "CAH:").trim();
}

let packMap = {};
function rangeToDeck({ values }) {
  let header = values.shift();
  if (header[0] == "Prompt Cards") {
    return values.map((row) => {
      let name = normalizeName(row[2]);
      if (!packMap[name]) {
        packMap[name] = {
          id: nanoid(4),
          official: !!row[3].match("CAH"),
        };
      }
      let picks = row[0].match(/_+/g);
      return [
        packMap[name].id,
        replaceExoticChars(row[0].replace(/_+/g, "_")),
        picks ? picks.length : row[0] == "Make a haiku." ? 3 : 1,
      ];
    });
  }
  return values.map((row) => {
    let name = normalizeName(row[1]);
    if (!packMap[name]) {
      packMap[name] = { id: nanoid(4), official: !!name.match("CAH") };
    }
    return [packMap[name].id, replaceExoticChars(row[0])];
  });
}

/**
 *{
 *  "black": [{
 *    "content": "",
 *    "pick": 1,
 *    "draw": 1
 *  }],
 *  "white": [""],
 *  "pack": {
 *    "id": "",
 *    "name": ""
 *  },
 *  "quantity": {
 *    "black": #,
 *    "white": #,
 *    "total": #
 *  }
 *}
 */
function crunch(text) {
  return text.replace(/[^a-zA-Z]/g, "");
}
function allBadCards(cards) {
  let packs = {};
  for (let name in packMap) {
    let pack = packMap[name];
    if (pack.official) {
      packs[pack.id] = {
        set: new Set(),
        black: [],
        white: [],
        pack: {
          name,
          id: pack.id,
        },
        quantity: {
          black: 0,
          white: 0,
          total: 0,
        },
      };
    }
  }
  for (let card of cards) {
    let hash = crunch(card[1]);
    if (typeof packs[card[0]] == "undefined" || packs[card[0]].set.has(hash)) {
      continue;
    }
    packs[card[0]].set.add(hash);
    if (card.length > 2) {
      let bc = { content: card[1].replace(/_/g, "___") };
      if (card[1] > 1) {
        bc.draw = card[1] - 1;
        bc.pick = card[1];
      }
      packs[card[0]].black.push(bc);
      packs[card[0]].quantity.black += 1;
    } else {
      packs[card[0]].white.push(card[1]);
      packs[card[0]].quantity.white += 1;
    }
    packs[card[0]].quantity.total += 1;
  }
  for (let id in packs) {
    delete packs[id].set;
    packs[id] = { pack: packs[id], buildVersion: 2 };
    if (packs[id].pack.pack.name == "CAH Base Set") {
      fs.writeFileSync(
        "./allbadcards.baseonly.json",
        JSON.stringify(packs[id], null, "\t")
      );
    }
  }
  fs.writeFileSync(
    "./allbadcards.json",
    JSON.stringify(Object.values(packs), null, "\t")
  );
}

/**
 * Prints the names and majors of students in a sample spreadsheet:
 * @see https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 */
function saveCardsToJSON(auth) {
  console.log("getting ranges...");
  const sheets = google.sheets({ version: "v4", auth });
  sheets.spreadsheets.values.batchGet(
    {
      spreadsheetId: "1lsy7lIwBe-DWOi2PALZPf5DgXHx9MEvKfRw1GaWQkzg",
      ranges: ["Master Cards List!A:E", "Master Cards List!G:J"],
    },
    (err, ranges) => {
      if (err) return console.log("The API returned an error: " + err);
      console.log("parsing ranges...");
      let cards = ranges.data.valueRanges.map(rangeToDeck).flat();

      console.log("separating...");
      let white = [];
      let whiteSet = new Set();
      let black = [];
      let blackSet = new Set();
      let packs = {};
      let icons = require("./icons.json");
      for (let name in packMap) {
        let pack = packMap[name];
        packs[pack.id] = {
          name,
          white: [],
          black: [],
          official: pack.official,
          icon: icons[name],
        };
      }

      allBadCards(cards);

      for (let card of cards) {
        if (!card[1]) {
          continue;
        }
        if (card.length > 2) {
          packs[card[0]].black.push(black.length);
          if (!blackSet.has(card[1])) {
            blackSet.add(card[1]);
            black.push({
              text: card[1],
              pick: card[2],
            });
          }
        } else {
          packs[card[0]].white.push(white.length);
          if (!whiteSet.has(card[1])) {
            whiteSet.add(card[1]);
            white.push(
              card[1].replace(/^[\s\uFEFF\xA0\|]+|[\s\uFEFF\xA0\|]+$/g, "")
            ); // trim
          }
        }
      }

      console.log(`saving... (${white.length} white, ${black.length} black)`);
      fs.writeFileSync(
        "../compact.json",
        JSON.stringify({ white, black, packs: Object.values(packs) })
      );
    }
  );
}
