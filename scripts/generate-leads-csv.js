const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const DEFAULT_COUNT = 5;
const outputPath = path.join(process.cwd(), "sample-leads-upload.csv");

const firstNames = [
  "Ali",
  "Ahmed",
  "Usman",
  "Bilal",
  "Hassan",
  "Hina",
  "Sara",
  "Ayesha",
  "Fatima",
  "Zainab",
  "Hamza",
  "Umar",
  "Danish",
  "Kashif",
  "Sana",
  "Mariam",
  "Ibrahim",
  "Rehan",
  "Mahnoor",
  "Nimra",
];

const lastNames = [
  "Khan",
  "Raza",
  "Malik",
  "Tariq",
  "Butt",
  "Sheikh",
  "Qureshi",
  "Chaudhry",
  "Iqbal",
  "Nawaz",
  "Farooq",
  "Aslam",
  "Yousaf",
  "Rafique",
  "Javed",
];

const sources = ["Facebook Ads", "Website Form", "Referral", "WhatsApp", "Google Ads"];
const locations = ["Lahore", "Karachi", "Islamabad", "Rawalpindi", "Faisalabad"];
const areasByLocation = {
  Lahore: ["DHA Phase 6", "Johar Town", "Bahria Orchard", "Gulberg", "Model Town"],
  Karachi: ["Gulshan-e-Iqbal", "PECHS", "DHA Karachi", "North Nazimabad", "Clifton"],
  Islamabad: ["Bahria Town", "G-13", "F-11", "DHA Islamabad", "B-17"],
  Rawalpindi: ["Saddar", "Chaklala", "Bahria Town", "Adyala Road", "PWD"],
  Faisalabad: ["D Ground", "Canal Road", "Madina Town", "Satiana Road", "Samundri Road"],
};
const statuses = ["new", "follow_up", "interested", "assigned"];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBudget() {
  const min = 45;
  const max = 300;
  const inLac = Math.floor(Math.random() * (max - min + 1)) + min;
  return String(inLac * 100000);
}

function formatPhone(num) {
  return `03${String(num).padStart(9, "0")}`;
}

function generateRows(count) {
  const rows = [
    [
      "full_name",
      "email",
      "phone",
      "source",
      "budget",
      "location",
      "area",
      "status",
      "assigned_agent_email",
      "notes",
    ],
  ];

  const runToken = `${Date.now()}${crypto.randomBytes(3).toString("hex")}`;
  const runPhoneSeed =
    Number.parseInt(crypto.createHash("sha256").update(runToken).digest("hex").slice(0, 8), 16) %
    900000000;
  const usedEmails = new Set();
  const usedPhones = new Set();

  for (let i = 1; i <= count; i += 1) {
    const firstName = randomItem(firstNames);
    const lastName = randomItem(lastNames);
    const fullName = `${firstName} ${lastName}`;
    const location = randomItem(locations);
    const area = randomItem(areasByLocation[location]);
    const source = randomItem(sources);
    const status = randomItem(statuses);
    const budget = randomBudget();
    const uniqueId = `${runToken}${String(i).padStart(4, "0")}`;

    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${uniqueId}@example.com`;
    if (usedEmails.has(email)) {
      throw new Error("Email collision detected. Please run again.");
    }
    usedEmails.add(email);

    // Make phone numbers unique across different script runs as well.
    const runScopedPhone = 100000000 + ((runPhoneSeed + i) % 900000000);
    const phoneNumber = formatPhone(runScopedPhone);
    if (usedPhones.has(phoneNumber)) {
      throw new Error("Phone collision detected. Please run again.");
    }
    usedPhones.add(phoneNumber);

    rows.push([
      fullName,
      email,
      phoneNumber,
      source,
      budget,
      location,
      area,
      status,
      "",
      `Lead generated in batch ${runToken}`,
    ]);
  }

  return rows;
}

function escapeCsvCell(value) {
  const s = String(value ?? "");
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const countArg = Number.parseInt(process.argv[2] ?? String(DEFAULT_COUNT), 10);
const count = Number.isFinite(countArg) && countArg > 0 ? countArg : DEFAULT_COUNT;
const rows = generateRows(count);
const csv = rows.map((r) => r.map(escapeCsvCell).join(",")).join("\n");
fs.writeFileSync(outputPath, csv, "utf8");

console.log(`CSV generated at: ${outputPath}`);
console.log(`Total leads generated: ${count}`);
